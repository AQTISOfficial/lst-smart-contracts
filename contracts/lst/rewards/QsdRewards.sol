// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractRewards} from "./AbstractRewards.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract QsdRewards is AbstractRewards {
    constructor (uint _apy, uint _aqtisApy) AbstractRewards(_apy, _aqtisApy) {
    }
    function getRewardsFor(address user) external view override returns (RewardsDistribution memory) {
        uint256 twab = _getTWAB(user);
        uint timeSinceLastClaim = block.timestamp - _userRecords[user].lastClaimTime;

        uint usdcRewards = ((apy - aqtisApy) * twab * timeSinceLastClaim) / (DENOMINATOR * 365 days);
        uint aqtisRewards = _getAqtisRewards(twab, timeSinceLastClaim);

        return RewardsDistribution(usdcRewards, 0, aqtisRewards, 0);
    }

    function _beforeUpdate(address user, uint256 value, Update updateType) internal override {
        // Do nothing
    }

    function _beforeReset(address user) internal override {
        // Do nothing
    }

    function _getAqtisRewards(uint twab, uint duration) internal view returns (uint) {
        uint aqtisPrice = tokenPriceCalculator.getAqtisPriceInUSD();
        return (aqtisApy * twab * duration * 1e18 * 1e12) / (DENOMINATOR * aqtisPrice * 365 days);
    }
}