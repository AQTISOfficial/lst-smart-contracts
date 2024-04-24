// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {PseudoCappedERC20} from "../token/PseudoCappedERC20.sol";

/**
 * @title Abstract LSD Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract provides the LSD tokenomics
 */

abstract contract AbstractLST is PseudoCappedERC20, Ownable, ReentrancyGuard {
    using Address for address;
    using SafeERC20 for IERC20;

    // ======= Roles ======= //
    address public distributionAddress;

    // ======= State Variables ======= //
    bool public buyActive;
    bool public whitelistActive;
    uint256 public minAmountBuy;

    mapping(address => bool) public whitelist;

    // ======= Event Logs ======= //
    event BuyTokens(address indexed user, uint256 amount, uint256 newTotalSupply);
    event SoftMaxSupplyChanged(uint256 newSoftMaxSupply);

    event MinAmountBuyChanged(uint256 newMinAmountBuy);
    event BuyActivated(address indexed activator);
    event BuyDeactivated(address indexed deactivator);

    event WhitelistActivated(address indexed activator);
    event WhitelistDeactivated(address indexed deactivator);
    event WhitelistUpdated(address indexed addr, bool whitelisted);
    event DistributionAddressUpdated(address indexed newDistributionAddress);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalMaxSupply
    ) PseudoCappedERC20(_name, _symbol, _totalMaxSupply) Ownable(msg.sender) {}

    // ======= Setters ======= //

    function setMinAmountBuy(uint256 _newMinAmountBuy) external onlyOwner {
        require(_newMinAmountBuy > 0, "Min amount buy must be greater than 0");
        minAmountBuy = _newMinAmountBuy;
        emit MinAmountBuyChanged(_newMinAmountBuy);
    }

    function setBuyActive(bool _buyActive) external onlyOwner {
        buyActive = _buyActive;
        if (_buyActive) {
            emit BuyActivated(msg.sender);
        } else {
            emit BuyDeactivated(msg.sender);
        }
    }

    function setWhitelistActive(bool _whitelistActive) external onlyOwner {
        whitelistActive = _whitelistActive;
        if (_whitelistActive) {
            emit WhitelistActivated(msg.sender);
        } else {
            emit WhitelistDeactivated(msg.sender);
        }
    }

    function updateWhitelist(address _addr, bool _whitelisted) external onlyOwner {
        whitelist[_addr] = _whitelisted;
        emit WhitelistUpdated(_addr, _whitelisted);
    }

    function setDistributionAddress(address _distributionAddress) external onlyOwner {
        distributionAddress = _distributionAddress;
        emit DistributionAddressUpdated(_distributionAddress);
    }

    function setCap(uint256 _newCap) external onlyOwner {
        _setCap(_newCap);
        emit SoftMaxSupplyChanged(_newCap);
    }

    // ======= Modifiers ======= //
    modifier onlyBuyActive() {
        require(buyActive, "Abstract LST: buy not active");
        _;
    }

    modifier onlyWhitelist() {
        if (whitelistActive) {
            require(whitelist[msg.sender], "Abstract LST: caller is not whitelisted");
        }
        _;
    }

    // ======= Abstract Functions ======= //
    function buyTokensWithEth() external virtual payable;

    function buyTokens(uint amount) external virtual;

    // only for rewards address
    function mint(uint amount) external virtual;
    function mintWithCap(uint amount) external virtual;

    function setRewardsAddress(address _rewardsAddress) external virtual;
    function setTokenPriceCalculator(address _tokenPriceCalculator) external virtual;

    // ======= Internal Functions ======= //
    function _forwardEth(uint256 _amount) internal {
        require(distributionAddress != address(0), "Abstract LST: distributor address not set");
        require(_amount > 0, "Abstract LST: amount must be greater than 0");

        Address.sendValue(payable(distributionAddress), _amount);
    }

    function _forwardERC20(address _token, uint256 _amount) internal {
        require(_token != address(0), "Abstract LST: token address cannot be the zero address");
        require(_amount > 0, "Abstract LST: amount must be greater than 0");
        IERC20(_token).safeTransfer(distributionAddress, _amount);
    }

    function _afterBuy(address _user, uint256 _amount) internal {
        emit BuyTokens(_user, _amount, totalSupply());
    }

    // ======= External Functions ======= //

    /// @notice Allows the owner to withdraw stuck ETH from the contract
    function withdrawETH() external onlyOwner {
        require(owner() != address(0), "AbstractLST: owner cannot be the zero address");
        Address.sendValue(payable(owner()), address(this).balance);
    }

    /// @notice Allows the owner to withdraw any ERC20 token from the contract
    /// @param token The address of the ERC20 token to withdraw
    function withdrawERC20(address token) external onlyOwner {
        require(owner() != address(0), "AbstractLST: owner cannot be the zero address");
        IERC20(token).safeTransfer(owner(), IERC20(token).balanceOf(address(this)));
    }
}