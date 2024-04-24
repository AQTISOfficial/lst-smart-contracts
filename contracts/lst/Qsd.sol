// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Quant Reserve Token Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract handles tokenomics for Qsd
 */


import {AbstractLST} from "./AbstractLST.sol";
import {ITokenPriceCalculator} from "../interfaces/ITokenPriceCalculator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {QsdRewards} from "./rewards/QsdRewards.sol";

// ======= QSD Contract ======= //
contract Qsd is AbstractLST, QsdRewards {
    using SafeERC20 for IERC20;

    // ======= Constants ======= //
    uint constant public QSD_PRICE = 1;

    // ======= Dependencies ======= //
    address public immutable usdAddress;

    constructor(address _usd)
        // (name, symbol, totalMaxSupply, 15 %apy, 2.5%aqtisApy)
    AbstractLST("Quant State Dollar", "QSD", 1_000_000_000 * 1e6)
    QsdRewards(150, 25)
    {
        usdAddress = _usd;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function buyTokensWithEth() external override payable onlyBuyActive onlyWhitelist {
        uint tokensToMint = calculateTokensToMintWithEth(msg.value);

        // validate buy
        require(!_exceedsCap(tokensToMint), "Qsd: Buy exceeds cap");
        require(msg.value >= minAmountBuy, "Qsd: Insufficient buy amount");

        // execute buy
        _mint(msg.sender, tokensToMint);
        _forwardEth(msg.value);
        _afterBuy(msg.sender, tokensToMint);
    }

    function buyTokens(uint amount) external override onlyBuyActive onlyWhitelist {
        uint tokensToMint = calculateTokensToMintWithUSD(amount);

        // validate buy
        require(!_exceedsCap(tokensToMint), "Qsd: Buy exceeds cap");
        require(amount >= minAmountBuy, "Qsd: Insufficient buy amount");

        // transfer USD from user to contract
        IERC20(usdAddress).safeTransferFrom(msg.sender, address(this), amount);

        // execute buy
        _mint(msg.sender, tokensToMint);
        _forwardERC20(usdAddress, amount);
        _afterBuy(msg.sender, tokensToMint);
    }

    // ======= Permissioned Functions ======= //
    function mint(uint amount) external override onlyRewards {
        _mint(msg.sender, amount);
    }

    function mintWithCap(uint amount) external override onlyRewards {
        require(!_exceedsCap(amount), "Qsd: Mint exceeds cap");
        _mint(msg.sender, amount);
    }

    function setRewardsAddress(address _rewardsAddress) external override onlyOwner {
        _setRewardsAddress(_rewardsAddress);
    }

    function setContractRewardsWhitelist(address _contract, bool _whitelisted) external onlyOwner {
        _setWhitelistedContract(_contract, _whitelisted);
    }

    function setTokenPriceCalculator(address _tokenPriceCalculator) external override onlyOwner {
        _setTokenPriceCalculator(_tokenPriceCalculator);
    }

    // ======= Public View Functions ======= //
    function calculateTokensToMintWithUSD(uint amount) public view returns (uint) {
        uint usdPrice = tokenPriceCalculator.getLatestUsdPrice();
        return (amount * usdPrice) / (QSD_PRICE * 1e8);
    }

    function calculateTokensToMintWithEth(uint ethAmount) public view returns (uint) {
        uint ethPrice = tokenPriceCalculator.getLatestEthPrice();
        return (ethAmount * ethPrice) / (QSD_PRICE * 1e8 * 1e12);
    }

    // ======= Override Functions ======= //
    function _update(address from, address to, uint256 value) internal virtual override {
        super._update(from, to, value);

        _updateRecord(from, value, Update.FROM);
        _updateRecord(to, value, Update.TO);
    }
}