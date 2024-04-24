// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ITokenPriceCalculator} from "../interfaces/ITokenPriceCalculator.sol";

contract MockTokenPriceCalculator is ITokenPriceCalculator {
    uint256 public aqtisPriceInWETH;
    uint256 public aqtisPriceInUSD;
    uint256 public latestUsdPrice;
    uint256 public latestEthPrice;
    mapping(address => uint256) public lstPriceInWETH;

    function setAqtisPriceInWETH(uint256 _aqtisPriceInWETH) external {
        aqtisPriceInWETH = _aqtisPriceInWETH;
    }

    function setAqtisPriceInUSD(uint256 _aqtisPriceInUSD) external {
        aqtisPriceInUSD = _aqtisPriceInUSD;
    }

    function setLatestUsdPrice(uint _latestUsdPrice) external {
        latestUsdPrice = _latestUsdPrice;
    }

    function setLatestEthPrice(uint _latestEthPrice) external {
        latestEthPrice = _latestEthPrice;
    }

    function setLSTPriceInWETH(address lst, uint256 price) external {
        lstPriceInWETH[lst] = price;
    }

    function getAqtisPriceInWETH() external view override returns (uint256) {
        return aqtisPriceInWETH;
    }

    function getAqtisPriceInUSD() external view override returns (uint256) {
        return aqtisPriceInUSD;
    }

    function getLatestUsdPrice() public view override returns (uint256) {
        return latestUsdPrice;
    }

    function getLatestEthPrice() public view override returns (uint256) {
        return latestEthPrice;
    }

    function getLSTPriceInWETH(address lst) external view returns (uint256) {
        return lstPriceInWETH[lst];
    }

    function update() external override {}
}