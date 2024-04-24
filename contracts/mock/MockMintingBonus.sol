// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {MintingBonus} from "../rewards/MintingBonus.sol";

contract MockMintingBonus is MintingBonus {

    function initializeBonusProgram(address lst, uint activeTime, uint startTime, uint aqtisAmount, uint maxClaim) external {
        _initializeBonusProgram(lst, activeTime, startTime, aqtisAmount, maxClaim);
    }

    function claimableBonusRewards(address lst, address user) external view returns (uint) {
        return _claimableBonusRewards(lst, user);
    }

    function getRewardsSettings(address lst) external view returns (MintingBonus.RewardsSettings memory) {
        return rewardsSettings[lst];
    }
}