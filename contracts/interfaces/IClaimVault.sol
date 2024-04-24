// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Claim Vault Interface
 * @author A Q T I S / @AQTIS-Team
 * @notice Interface for claim vault
 */

interface IClaimVault {
    function claimRewards(address lst) external;

    function claimRewardsFor(address lst, address user) external;

    function getLSTs() external view returns (address[] memory);
}