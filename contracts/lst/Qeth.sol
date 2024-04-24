// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractLST} from "./AbstractLST.sol";
import {QethRewards} from "./rewards/QethRewards.sol";

/**
 * @title Quant Ethereum Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract handles tokenomics for qETH
 */

// ======= qETH Contract ======= //
contract Qeth is AbstractLST, QethRewards {
    constructor()
        // (name, symbol, totalMaxSupply, 10 %apy, 2.5%aqtisApy)
        AbstractLST("qETH", "qETH", 50_000 * 1e18)
        QethRewards(100, 25)
    {}

    function buyTokensWithEth() external override payable onlyBuyActive onlyWhitelist {
        uint tokensToMint = msg.value;

        // validate buy
        require(!_exceedsCap(tokensToMint), "Qeth: Buy exceeds cap");
        require(msg.value >= minAmountBuy, "Qeth: Insufficient buy amount");

        // execute buy
        _mint(msg.sender, tokensToMint);
        _forwardEth(msg.value);
        _afterBuy(msg.sender, tokensToMint);
    }

    function buyTokens(uint /*amount*/) external override view onlyBuyActive onlyWhitelist {
        require(false, "Qeth: Buying with tokens is not allowed");
    }

    // ======= Permissioned Functions ======= //
    function mint(uint amount) external override onlyRewards {
        _mint(msg.sender, amount);
    }

    function mintWithCap(uint amount) external override onlyRewards {
        require(!_exceedsCap(amount), "Qeth: Mint exceeds cap");
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

    // ======= Override Functions ======= //
    function _update(address from, address to, uint256 value) internal virtual override {
        super._update(from, to, value);

        _updateRecord(from, value, Update.FROM);
        _updateRecord(to, value, Update.TO);
    }
}
