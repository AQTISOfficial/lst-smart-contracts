// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IRewards} from "../../interfaces/IRewards.sol";
import {ITokenPriceCalculator} from "../../interfaces/ITokenPriceCalculator.sol";

abstract contract AbstractRewards is IRewards {
    using EnumerableSet for EnumerableSet.AddressSet;
    enum Update {FROM, TO}

    struct UserRecord {
        uint256 userBalance;
        uint256 lastUpdateTime;
        uint256 cumulativeBalance;
        uint256 cumCirculatingSupplyLastClaim;
        uint256 lastClaimTime;
    }

    // ======= Dependencies ======= //
    address public rewardsAddress;
    ITokenPriceCalculator public tokenPriceCalculator;

    // ======= State Variables ======= //
    uint public immutable apy;
    uint public immutable aqtisApy;
    uint public constant DENOMINATOR = 1000;

    struct Supply {
        uint totalSupply;
        uint lastUpdateTime;
        uint currentCirculatingSupply;
        uint cumulativeCirculatingSupply;
    }

    Supply internal _supply;
    mapping(address => bool) public whitelistedContracts;

    constructor(uint _apy, uint _aqtisApy) {
        apy = _apy;
        aqtisApy = _aqtisApy;
    }

    modifier onlyRewards {
        require(msg.sender == rewardsAddress, "Rewards: Only rewards contract can call this function");
        _;
    }

    // ======= State Variables ======= //
    mapping(address => UserRecord) internal _userRecords;

    // ======= Setters Variables ======= //
    function _setRewardsAddress(address _rewardsAddress) internal {
        rewardsAddress = _rewardsAddress;
    }

    function _setTokenPriceCalculator(address _tokenPriceCalculator) internal {
        tokenPriceCalculator = ITokenPriceCalculator(_tokenPriceCalculator);
    }

    // ======= Abstract Functions ======= //

    function getRewardsFor(address user) external view virtual returns (RewardsDistribution memory);

    function _beforeUpdate(address user, uint256 value, Update updateType) internal virtual;

    function _beforeReset(address user) internal virtual;

    // ======= External Functions ======= //

    function resetUser(address user) external onlyRewards {
        _resetUser(user);
    }

    // ======= Internal Functions ======= //
    function _updateSupply(address user, uint256 value, Update updateType) internal {
        uint updateDiff = block.timestamp - _supply.lastUpdateTime;
        _supply.cumulativeCirculatingSupply += _supply.currentCirculatingSupply * updateDiff;

        // handle mint and burn
        if (user == address(0)) {
            if (updateType == Update.FROM) {
                _supply.totalSupply += value;
            } else if (updateType == Update.TO) {
                _supply.totalSupply -= value;
            }
        }

        bool userIsContract = isContract(user);
        if (userIsContract && _userRecords[user].userBalance != 0) {
            // adjust circulating supply by remaining contract balance
            if (updateType == Update.FROM)
                _supply.currentCirculatingSupply -= (_userRecords[user].userBalance - value);
            else if (updateType == Update.TO) {
                _supply.currentCirculatingSupply -= (_userRecords[user].userBalance + value);
            }
            delete _userRecords[user];
        } else if (updateType == Update.FROM && (user == address(0) || userIsContract)) {
            _supply.currentCirculatingSupply += value;
        } else if (updateType == Update.TO && (user == address(0) || userIsContract)) {
            _supply.currentCirculatingSupply -= value;
        }
        _supply.lastUpdateTime = block.timestamp;
    }

    function _updateRecord(address user, uint256 value, Update updateType) internal {
        _beforeUpdate(user, value, updateType);

        _updateSupply(user, value, updateType);

        if (user == address(0) || isContract(user)) {
            return;
        }

        UserRecord storage record = _userRecords[user];
        uint256 timeElapsed = 0;

        // First entry check
        if (record.lastUpdateTime == 0) {
            record.cumulativeBalance = 0;
            record.cumCirculatingSupplyLastClaim = _supply.cumulativeCirculatingSupply;
            record.lastClaimTime = block.timestamp;
        } else {
            timeElapsed = block.timestamp - record.lastUpdateTime;
            record.cumulativeBalance += record.userBalance * timeElapsed;
        }

        // Update balance and last update time
        if (updateType == Update.FROM) {
            record.userBalance -= value;
        } else {
            record.userBalance += value;
        }
        record.lastUpdateTime = block.timestamp;
    }

    function _getTWAB(address user) internal view returns (uint256) {
        UserRecord memory record = _userRecords[user];
        uint256 claimTime = block.timestamp - record.lastClaimTime;
        if (claimTime == 0) {
            return 0;
        }

        uint256 timeDifference = block.timestamp - record.lastUpdateTime;
        return (record.cumulativeBalance + (record.userBalance * timeDifference)) / claimTime;
    }

    function _resetUser(address user) internal {
        _beforeReset(user);
        UserRecord storage record = _userRecords[user];
        record.lastClaimTime = block.timestamp;
        record.lastUpdateTime = block.timestamp;
        record.cumulativeBalance = 0;
        record.cumCirculatingSupplyLastClaim = cumulativeCirculatingSupply();
    }

    function _setWhitelistedContract(address _contract, bool _isWhitelisted) internal {
        whitelistedContracts[_contract] = _isWhitelisted;
    }

    // ======= Public View Functions ======= //
    function twaCircSupplySinceLastClaim(address user) public view returns (uint) {
        UserRecord memory record = _userRecords[user];
        uint claimTime = block.timestamp - record.lastClaimTime;
        require(claimTime > 0, "Rewards: Claim time is 0");

        return (cumulativeCirculatingSupply() - record.cumCirculatingSupplyLastClaim) / claimTime;
    }

    function circulatingSupply() public view returns (uint) {
        return _supply.currentCirculatingSupply;
    }

    function cumulativeCirculatingSupply() public view returns (uint){
        uint updateDiff = block.timestamp - _supply.lastUpdateTime;
        return _supply.cumulativeCirculatingSupply + _supply.currentCirculatingSupply * updateDiff;
    }

    function userTWAB(address user) external view returns (uint) {
        return _getTWAB(user);
    }

    function lastClaimTime(address user) external view returns (uint) {
        return _userRecords[user].lastClaimTime;
    }

    // ======= Utils ======= //
    function isContract(address addr) internal view returns (bool) {
        if (whitelistedContracts[addr]) {
            return false;
        }
        uint size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

}