// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractRewards} from "./AbstractRewards.sol";

contract QethRewards is AbstractRewards {

    constructor(uint _apy, uint _aqtisApy) AbstractRewards(_apy, _aqtisApy){}

    function getRewardsFor(address user) external view override returns (RewardsDistribution memory) {
        uint256 twab = _getTWAB(user);
        uint timeSinceClaim = block.timestamp - _userRecords[user].lastClaimTime;

        uint ethRewards = ((apy - aqtisApy) * twab * timeSinceClaim) / (DENOMINATOR * 365 days);
        uint aqtisRewards = _getAqtisRewards(twab, timeSinceClaim);

        return RewardsDistribution(0, ethRewards, aqtisRewards, 0);
    }

    function _beforeUpdate(address user, uint256 value, Update updateType) internal override {
        // Do nothing
    }

    function _beforeReset(address user) internal override {
        // Do nothing
    }

    function _getAqtisRewards(uint twab, uint duration) internal view returns (uint) {
        uint aqtisPrice = tokenPriceCalculator.getAqtisPriceInWETH();
        return (aqtisApy * twab * duration * 1e18) / (DENOMINATOR * 365 days * aqtisPrice);
    }
}