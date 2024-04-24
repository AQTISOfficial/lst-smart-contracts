// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PseudoCappedERC20 Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract provides the base functionality for a soft-capped ERC20 token
 */

contract PseudoCappedERC20 is ERC20 {
    uint256 internal _cap;

    constructor(
        string memory __name,
        string memory __symbol,
        uint256 __cap
    )
        ERC20(__name, __symbol)
    {
        _cap = __cap;
    }

    function _setCap(uint256 __newCap) internal {
        _cap = __newCap;
    }

    function _exceedsCap(uint256 amount) internal view returns (bool) {
        return totalSupply() + amount > _cap;
    }

    function cap() external view returns (uint256) {
        return _cap;
    }
}