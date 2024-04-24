// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractRewards} from "../lst/rewards/AbstractRewards.sol";

contract MockAbstractRewards is AbstractRewards {
    constructor(uint _apy, uint _aqtisApy) AbstractRewards(_apy, _aqtisApy){}

    bool public beforeUpdateCalled = false;
    bool public beforeResetCalled = false;

    function _beforeUpdate(address user, uint256 value, Update updateType) internal override {
        beforeUpdateCalled = true;
    }

    function _beforeReset(address user) internal override {
        beforeResetCalled = true;
    }

    function getRewardsFor(address user) external view override returns (RewardsDistribution memory) {
        return RewardsDistribution(0, 0, 0, 0);
    }

    function updateRecord(address user, uint256 value, Update updateType) external {
        _updateRecord(user, value, updateType);
    }

    function setContractRewardsWhitelist(address _contract, bool _whitelisted) external {
        _setWhitelistedContract(_contract, _whitelisted);
    }

    function setRewardsAddress(address _rewardsAddress) external {
        _setRewardsAddress(_rewardsAddress);
    }

    function cumulativeCirculatingSupplyLastClaim(address user) external view returns (uint) {
        return _userRecords[user].cumCirculatingSupplyLastClaim;
    }
}