// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {LSTSwap} from "../trade/LSTSwap.sol";
import {IRewards} from "../interfaces/IRewards.sol";
import {ILST} from "../interfaces/ILST.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {MintingBonus} from "./MintingBonus.sol";

/**
 * @title Claim Vault
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract is allows users to claim rewards they've accumulated on held LSTs
 * @dev This contract uses OpenZeppelin contracts for added security.
 */
contract ClaimVault is LSTSwap, ReentrancyGuard, Ownable, MintingBonus {
    using SafeERC20 for IERC20;
    using Address for address;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint public claimCooldown;
    mapping(address => mapping(address => uint)) public lastClaimTime;

    // ======= State Variables ======= //
    address public immutable aqtisToken;
    EnumerableSet.AddressSet private _lstTokens;
    mapping(address => mapping(address => address)) public delegatedRewardsReceivers;
    mapping(address => mapping(address => bool)) public autoCompound;

    // ======= Events ======= //
    event LSTAdded(address indexed lst);
    event LSTRemoved(address indexed lst);
    event LSTUsdcPairSet(address indexed lst, address pair);
    event LSTWethPairSet(address indexed lst, address pair);
    event FactoryUpdated(address oldFactory, address newFactory);
    event ClaimCooldownSet(uint oldCooldown, uint newCooldown);
    event TimeWeightedAveragePeriodSet(uint24 oldPeriod, uint24 newPeriod);
    event MinOutFractionSet(uint oldFraction, uint newFraction);
    event AutocompoundSet(address indexed lst, address indexed user, bool compound);
    event RewardsDelegated(address indexed lst, address indexed user, address receiver);

    event AutoCompoundClaimed(
        address indexed lst,
        address indexed user,
        address quoteToken,
        uint amount,
        uint quoteAmount
    );

    event RewardsClaimed(
        address indexed lst,
        address indexed user,
        address token,
        uint amount
    );

    constructor(
        address _factory,
        address _usdc,
        address _weth,
        address _aqtisToken
    ) LSTSwap(_factory, _usdc, _weth) Ownable(msg.sender) {
        aqtisToken = _aqtisToken;
        claimCooldown = 12 hours;
    }

    // ======= Modifiers ======= //
    modifier onlyValidLST(address lst) {
        require(_lstTokens.contains(lst), "LST address not found");
        _;
    }

    /// @notice Allows a user to claim their rewards.
    /// @dev This function can be called once per day by each user
    function claimRewards(address lst) external {
        _claim(lst, msg.sender);
    }

    // ToDo: Decide whether this function needs to be restricted to the BatchClaim contract
    function claimRewardsFor(address lst, address user) external {
        _claim(lst, user);
    }

    // ======= Internal Functions ======= //
    function _claim(address lst, address user) internal nonReentrant onlyValidLST(lst) {
        require(lastClaimTime[user][lst] + claimCooldown < block.timestamp, "ClaimVault: Cooldown not expired");

        IRewards.RewardsDistribution memory rewards = IRewards(lst).getRewardsFor(user);
        address receiver = user;
        if (delegatedRewardsReceivers[lst][user] != address(0)) {
            receiver = delegatedRewardsReceivers[lst][user];
        }

        if (rewards.ethRewards > 0) {
            _handleWETHRewards(lst, user, receiver, rewards.ethRewards);
        }

        if (rewards.usdcRewards > 0) {
            _handleUSDCRewards(lst, user, receiver, rewards.usdcRewards);
        }

        if (rewards.cappedLSTRewards > 0) {
            _handleCappedLSTRewards(lst, user, receiver, rewards.cappedLSTRewards);
        }

        uint bonusRewards = _claimableBonusRewards(lst, user);
        uint totalAqtisRewards = rewards.aqtisRewards + bonusRewards;

        if (totalAqtisRewards > 0) {
            IERC20(aqtisToken).safeTransfer(receiver, totalAqtisRewards);
        }
        if (bonusRewards > 0) {
            _adjustRemainingBonusRewards(lst, bonusRewards);
        }

        lastClaimTime[user][lst] = block.timestamp;
        IRewards(lst).resetUser(user);
    }

    function _handleUSDCRewards(address lst, address user, address receiver, uint amount) internal {
        if (autoCompound[lst][user]) {
            uint quote = _getQuoteExactOut(lst, amount, PairType.USDC);
            ILST(lst).mintWithCap(quote);
            IERC20(lst).safeTransfer(receiver, quote);
            emit AutoCompoundClaimed(lst, user, usdc, quote, amount);
        } else {
            _mintForExactOutUSDC(lst, amount);
            IERC20(usdc).safeTransfer(receiver, amount);
            emit RewardsClaimed(lst, user, usdc, amount);
        }
    }

    function _handleWETHRewards(address lst, address user, address receiver, uint amount) internal {
        if (autoCompound[lst][user]) {
            uint quote = _getQuoteExactOut(lst, amount, PairType.WETH);
            ILST(lst).mintWithCap(quote);
            IERC20(lst).safeTransfer(receiver, quote);
            emit AutoCompoundClaimed(lst, user, weth, quote, amount);
        } else {
            _mintForExactOutETH(lst, amount);
            IWETH9(weth).withdraw(amount);
            Address.sendValue(payable(receiver), amount);
            emit RewardsClaimed(lst, user, weth, amount);
        }
    }

    function _handleCappedLSTRewards(address lst, address user, address receiver, uint amount) internal {
        if (autoCompound[lst][user]) {
            ILST(lst).mintWithCap(amount);
            IERC20(lst).safeTransfer(receiver, amount);
            emit AutoCompoundClaimed(lst, user, lst, amount, amount);
        } else {
            uint swapAmount = amount / 2;
            uint usdcAmount = _mintWithExactInUSDC(lst, swapAmount);
            IERC20(usdc).safeTransfer(receiver, usdcAmount);
            emit RewardsClaimed(lst, user, usdc, usdcAmount);

            uint wethAmount = _mintWithExactInETH(lst, swapAmount);
            IWETH9(weth).withdraw(wethAmount);
            Address.sendValue(payable(receiver), wethAmount);
            emit RewardsClaimed(lst, user, weth, wethAmount);
        }
    }

    // ======= Admin Functions ======= //

    function setUsdcPair(address lst, address pair) external onlyOwner onlyValidLST(lst) {
        _setUsdcPair(lst, pair);
        emit LSTUsdcPairSet(lst, pair);
    }

    function setWethPair(address lst, address pair) external onlyOwner onlyValidLST(lst) {
        _setWethPair(lst, pair);
        emit LSTWethPairSet(lst, pair);
    }

    function initializeBonusProgram(address lst, uint activeTime, uint startTime, uint aqtisAmount, uint maxClaim) external onlyOwner onlyValidLST(lst) {
        _initializeBonusProgram(lst, activeTime, startTime, aqtisAmount, maxClaim);
    }

    function addLST(address lst) external onlyOwner {
        _lstTokens.add(lst);
        emit LSTAdded(lst);
    }

    function removeLST(address lst) external onlyOwner {
        _lstTokens.remove(lst);
        emit LSTRemoved(lst);
    }

    function updateFactory(address _factory) external onlyOwner {
        emit FactoryUpdated(factory, _factory);
        _updateFactory(_factory);
    }

    function setClaimCooldown(uint cooldown) external onlyOwner {
        emit ClaimCooldownSet(claimCooldown, cooldown);
        claimCooldown = cooldown;
    }

    function setTimeWeightedAveragePeriod(uint24 period) external onlyOwner {
        emit TimeWeightedAveragePeriodSet(timeWeightedAveragePeriod, period);
        _setTimeWeightedAveragePeriod(period);
    }

    function setMinOutFractionQ64(uint fraction) external onlyOwner {
        emit MinOutFractionSet(minOutFractionQ64, fraction);
        _setMinOutFractionQ64(fraction);
    }

    // ======= Panic Functions ======= //

    function withdrawETH(uint amount) external onlyOwner {
        Address.sendValue(payable(owner()), amount);
    }

    function withdrawERC20(address token, uint amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ======= View Functions ======= //
    function getLSTs() external view returns (address[] memory) {
        return _lstTokens.values();
    }

    function getRewardsFor(address lst, address user) external view returns (IRewards.RewardsDistribution memory) {
        return IRewards(lst).getRewardsFor(user);
    }

    function getBonusRewardsFor(address lst, address user) external view returns (uint) {
        return _claimableBonusRewards(lst, user);
    }

    function getRewardsSettings(address lst) external view returns (MintingBonus.RewardsSettings memory) {
        return rewardsSettings[lst];
    }

    function isAutoCompounding(address lst, address user) external view returns (bool) {
        return autoCompound[lst][user];
    }

    function estimateValueUSDC(address lst, uint amount) external view returns (uint) {
        return _getQuoteExactOut(lst, amount, PairType.USDC);
    }

    function estimateValueWETH(address lst, uint amount) external view returns (uint) {
        return _getQuoteExactOut(lst, amount, PairType.WETH);
    }

    // ======= Config Functions ======= //

    function setAutoCompound(address lst, bool compound) external onlyValidLST(lst) {
        autoCompound[lst][msg.sender] = compound;
        emit AutocompoundSet(lst, msg.sender, compound);
    }

    function delegateRewards(address lst, address receiver) external onlyValidLST(lst) {
        delegatedRewardsReceivers[lst][msg.sender] = receiver;
        emit RewardsDelegated(lst, msg.sender, receiver);
    }
}