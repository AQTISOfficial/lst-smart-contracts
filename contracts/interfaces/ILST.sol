// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.9.0;

/**
 * @title LST Interface
 * @author A Q T I S / @AQTIS-Team
 * @notice Interface for rewards tracker
 */

interface ILST {
    function apy() external view returns (uint256);

    function aqtisApy() external view returns (uint256);

    function DENOMINATOR() external view returns (uint256);

    function mint(uint256 amount) external;

    function mintWithCap(uint256 amount) external;
}
