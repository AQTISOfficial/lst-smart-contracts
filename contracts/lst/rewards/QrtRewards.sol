// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractRewards} from "./AbstractRewards.sol";

contract QrtRewards is AbstractRewards {

    mapping(address => uint) public cumSupplyLastClaim;
    uint public currentCumSupply;
    uint public lastSupplyUpdateTime;

    constructor(uint _apy, uint _aqtisApy) AbstractRewards(_apy, _aqtisApy){}

    function getRewardsFor(address user) external view override returns (RewardsDistribution memory) {
        uint256 twab = _getTWAB(user);
        uint timeSinceLastClaim = block.timestamp - _userRecords[user].lastClaimTime;
        uint qrtRewards = ((apy - aqtisApy) * _twaSupplySinceLastClaim(user) * twab * timeSinceLastClaim) / (DENOMINATOR * twaCircSupplySinceLastClaim(user) * 365 days);
        uint aqtisRewards = _getAqtisRewards(twab, timeSinceLastClaim);
        return RewardsDistribution(0, 0, aqtisRewards, qrtRewards);
    }

    function _beforeUpdate(address user, uint256 /*value*/, Update /*updateType*/) internal override {
        if (user == address(0)) {
            // this is either a burn or a mint, in either case, update cum supply
            uint timeDiff = block.timestamp - lastSupplyUpdateTime;
            currentCumSupply += _supply.totalSupply * timeDiff;
            lastSupplyUpdateTime = block.timestamp;
        } else if (cumSupplyLastClaim[user] == 0) {
            // this is just an initial update for the user
            cumSupplyLastClaim[user] = currentCumSupply;
        }
    }

    function _beforeReset(address user) internal override {
        cumSupplyLastClaim[user] = currentCumSupply;
    }

    function _currentCumulativeSupply() public view returns (uint) {
        uint timeDiff = block.timestamp - lastSupplyUpdateTime;
        return currentCumSupply + _supply.totalSupply * timeDiff;
    }

    function _twaSupplySinceLastClaim(address user) public view returns (uint) {
        uint timeDiff = block.timestamp - _userRecords[user].lastClaimTime;
        return (_currentCumulativeSupply() - cumSupplyLastClaim[user]) / timeDiff;
    }

    function _getAqtisRewards(uint twab, uint duration) internal view returns (uint) {
        uint aqtisPrice = tokenPriceCalculator.getAqtisPriceInUSD();
        // aqtisPrice is in 1e18 and twab is in 1e6 so we multiply by 1e18 and 1e12
        // to get 1e18 output
        return aqtisApy * 10 * twab * duration * 1e18 * 1e12 / (DENOMINATOR * aqtisPrice * 365 days);
    }
}