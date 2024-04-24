// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IRewards} from "../interfaces/IRewards.sol";

contract MintingBonus {

    struct RewardsSettings {
        uint activeTime;
        uint startTime;
        uint maxClaim;
        uint totalRewards;
        uint remainingRewards;
    }

    // ======= Events ======= //
    event RewardsProgramInitialized(address lst, uint activeTime, uint startTime, uint totalRewards, uint maxClaim);
    event RewardsProgramEnded(address lst, uint activeTime, uint startTime, uint totalRewards, uint maxClaim);

    mapping(address => RewardsSettings) internal rewardsSettings;

    // ======= View Functions ======= //
    function getLSTSettings(address lst) external view returns (RewardsSettings memory) {
        return rewardsSettings[lst];
    }

    function isRewardActive(address lst) external view returns (bool) {
        return rewardsSettings[lst].activeTime > block.timestamp;
    }

    // ======= Internal Functions ======= //
    function _claimableBonusRewards(address lst, address user) internal view returns (uint) {
        // check for no rewards program
        if (rewardsSettings[lst].totalRewards == 0) {
            return 0;
        }

        // check for rewards program not started
        if (rewardsSettings[lst].startTime > block.timestamp) {
            return 0;
        }
        uint lastClaim = IRewards(lst).lastClaimTime(user);

        // check if ended
        if (lastClaim >= rewardsSettings[lst].startTime + rewardsSettings[lst].activeTime) {
            return 0;
        }

        uint timeDiff = block.timestamp - lastClaim;
        uint userBalance = IRewards(lst).userTWAB(user);

        // no rewards for no balance
        if (userBalance == 0) return 0;

        uint circulatingSupply = IRewards(lst).twaCircSupplySinceLastClaim(user);

        uint numerator = userBalance * timeDiff * rewardsSettings[lst].totalRewards;
        uint denominator = circulatingSupply * rewardsSettings[lst].activeTime;
        uint bonusAmount = numerator / denominator;

        if (bonusAmount > rewardsSettings[lst].remainingRewards) {
            bonusAmount = rewardsSettings[lst].remainingRewards;
        }

        if (bonusAmount > rewardsSettings[lst].maxClaim) {
            bonusAmount = rewardsSettings[lst].maxClaim;
        }

        return bonusAmount;
    }

    function _initializeBonusProgram(address lst, uint activeTime, uint startTime, uint totalRewards, uint maxClaim) internal {
        rewardsSettings[lst] = RewardsSettings({
            activeTime: activeTime,
            startTime: startTime,
            maxClaim: maxClaim,
            totalRewards: totalRewards,
            remainingRewards: totalRewards
        });
        emit RewardsProgramInitialized(lst, activeTime, startTime, totalRewards, maxClaim);
    }

    function _adjustRemainingBonusRewards(address lst, uint amount) internal {
        if (rewardsSettings[lst].remainingRewards <= amount) {
            rewardsSettings[lst].remainingRewards = 0;
            emit RewardsProgramEnded(lst, rewardsSettings[lst].activeTime, rewardsSettings[lst].startTime, rewardsSettings[lst].totalRewards, rewardsSettings[lst].maxClaim);
            return;
        }
        rewardsSettings[lst].remainingRewards -= amount;
    }

}