// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IClaimVault} from "../interfaces/IClaimVault.sol";

/**
 * @title BatchClaim Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract handles batch claiming of rewards
 */

contract BatchClaim is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet internal _enabledUsers;
    mapping(address => mapping(address => bool)) public userLSTConfig;

    // dependencies
    IClaimVault public immutable claimVault;
    address public scheduler;

    // ======= Events ======= //
    event ClaimFailed(address indexed user, address indexed lst, string reason);
    event AutoClaimEnabled(address indexed user, address indexed lst);
    event AutoClaimDisabled(address indexed user, address indexed lst);

    constructor(address _claimVault) Ownable(msg.sender) {
        require(_claimVault != address(0), "Rewards tracker address cannot be the zero address");

        claimVault = IClaimVault(_claimVault);
    }

    // ======= Modifiers ======= //
    modifier onlyScheduler() {
        require(msg.sender == owner() || msg.sender == scheduler, "BatchClaim: Caller is not authorized");
        _;
    }

    // ======= External Functions ======= //
    function setAutoClaim(address lst, bool _enabled) external {
        address[] memory lsts = claimVault.getLSTs();
        bool validLST = false;
        for (uint i = 0; i < lsts.length; i++) {
            if (lst == lsts[i]) {
                validLST = true;
                break;
            }
        }
        require(validLST, "BatchClaim: LST not found");

        userLSTConfig[msg.sender][lst] = _enabled;
        // remove user if they have no LSTs enabled
        bool remove = true;
        // this should only be three LSTs, so O(n) is fine
        for (uint i = 0; i < lsts.length; i++) {
            if (userLSTConfig[msg.sender][lsts[i]]) {
                remove = false;
                break;
            }
        }

        if (remove) {
            _enabledUsers.remove(msg.sender);
        } else if (!_enabledUsers.contains(msg.sender)) {
            _enabledUsers.add(msg.sender);
        }

        if (_enabled) {
            emit AutoClaimEnabled(msg.sender, lst);
        } else {
            emit AutoClaimDisabled(msg.sender, lst);
        }
    }

    function isAutoClaimEnabled(address lst, address _user) external view returns (bool) {
        return userLSTConfig[_user][lst];
    }

    function getAutoClaimUsers() external view returns (address[] memory) {
        return _enabledUsers.values();
    }

    // ======= Permissioned Functions ======= //

    function setScheduler(address _scheduler) external onlyOwner {
        require(_scheduler != address(0), "BatchClaim: Scheduler address cannot be the zero address");
        scheduler = _scheduler;
    }

    function batchClaim() external onlyScheduler {
        address[] memory lsts = claimVault.getLSTs();

        for (uint256 i = 0; i < _enabledUsers.length(); i++) {
            address user = _enabledUsers.at(i);
            for (uint256 j = 0; j < lsts.length; j++) {
                if (userLSTConfig[user][lsts[j]]) {
                    claimRewardsFor(lsts[j], user);
                }
            }
        }
    }

    function multiClaim(address[] calldata _users) external onlyScheduler {
        address[] memory lsts = claimVault.getLSTs();

        for (uint256 i = 0; i < _users.length; i++) {
            address user = _users[i];
            for (uint256 j = 0; j < lsts.length; j++) {
                if (userLSTConfig[user][lsts[j]]) {
                    claimRewardsFor(lsts[j], user);
                }
            }
        }
    }

    function multiClaimLST(address lst, address[] calldata _users) external onlyScheduler {
        for (uint256 i = 0; i < _users.length; i++) {
            if (userLSTConfig[_users[i]][lst]) {
                claimRewardsFor(lst, _users[i]);
            }
        }
    }

    function claimRewardsFor(address lst, address user) internal {
        try claimVault.claimRewardsFor(lst, user) {
            // success
        } catch Error(string memory reason) {
            emit ClaimFailed(user, lst, reason);
        } catch {
            emit ClaimFailed(user, lst, "Unknown error");
        }
    }

}