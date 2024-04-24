// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {QrtRewards} from "../lst/rewards/QrtRewards.sol";

contract MockQrtRewards is QrtRewards {
    constructor() QrtRewards(175, 25){}

    // expose some functions for testing
    function setRewardsAddress(address _rewardsAddress) external {
        _setRewardsAddress(_rewardsAddress);
    }

    function setTokenPriceCalculator(address _tokenPriceCalculator) external {
        _setTokenPriceCalculator(_tokenPriceCalculator);
    }

    function beforeUpdate(address user, uint256 value, Update updateType) external {
        _beforeUpdate(user, value, updateType);
    }

    function beforeReset(address user) external {
        _beforeReset(user);
    }


    function resetUserMock(address user) external {
        _resetUser(user);
    }

    function updateRecord(address user, uint256 value, Update updateType) external {
        _updateRecord(user, value, updateType);
    }

    function getTWAB(address user) external view returns (uint256) {
        return _getTWAB(user);
    }
}