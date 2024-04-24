// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Token Price Calculator Interface
 * @notice Interface for token price calculator
 */
interface ITokenPriceCalculator {
    function update() external;

    function getAqtisPriceInWETH() external view returns (uint256);
    function getAqtisPriceInUSD() external view returns (uint256);

    function getLatestUsdPrice() external view returns (uint256);
    function getLatestEthPrice() external view returns (uint256);
}
