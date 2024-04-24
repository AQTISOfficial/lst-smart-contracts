// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IRewards {
    struct RewardsDistribution {
        uint256 usdcRewards;
        uint256 ethRewards;
        uint256 aqtisRewards;
        uint256 cappedLSTRewards;
    }

    function getRewardsFor(address user) external view returns (RewardsDistribution memory);

    function resetUser(address user) external;

    function twaCircSupplySinceLastClaim(address user) external view returns (uint);

    function circulatingSupply() external view returns (uint);

    function cumulativeCirculatingSupply() external view returns (uint);

    function userTWAB(address user) external view returns (uint);

    function lastClaimTime(address user) external view returns (uint);
}