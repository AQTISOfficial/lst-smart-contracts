// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {UniswapV2PriceOracle} from "./UniswapV2PriceOracle.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
/**
 * @title Token Price Calculator Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract provides price information for AQTIS token
 */

/// @title Aggregator Interface for Chainlink Oracles
/// @dev Interface for interacting with Chainlink Oracle to fetch price data
/// @notice Returns the latest round data of the Oracle
interface AggregatorV3Interface {
    function latestRoundData() external view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract TokenPriceCalculator is UniswapV2PriceOracle, Ownable {

    AggregatorV3Interface internal immutable priceFeedEth;
    AggregatorV3Interface internal immutable priceFeedUsd;

    address public immutable aqtisAddress;
    mapping(address => uint) public stalePeriod;

    // ======= Events ======= //
    event StalePeriodSet(address indexed priceFeed, uint oldPeriod, uint newPeriod);

    constructor(address _aqtisWethPair, address _priceFeedEthAddress, address _priceFeedUsdAddress, address _aqtisAddress)
    UniswapV2PriceOracle(_aqtisWethPair)
    Ownable(msg.sender)
    {
        require(_aqtisWethPair != address(0), "Uniswap pair address cannot be the zero address");
        require(_priceFeedEthAddress != address(0), "ETH price feed address cannot be the zero address");
        require(_priceFeedUsdAddress != address(0), "USD price feed address cannot be the zero address");

        // aqtis token
        aqtisAddress = _aqtisAddress;

        // chainlink price feeds
        priceFeedEth = AggregatorV3Interface(_priceFeedEthAddress);
        priceFeedUsd = AggregatorV3Interface(_priceFeedUsdAddress);

        stalePeriod[_priceFeedEthAddress] = 3 hours;
        stalePeriod[_priceFeedUsdAddress] = 24 hours;
    }

    /// @notice Returns Token Price in Wei (18 decimals)
    function getAqtisPriceInWETH() public view returns (uint256) {
        return getPrice(aqtisAddress);
    }

    /// @notice Returns Token Price in USD (18 decimals)
    function getAqtisPriceInUSD() public view returns (uint256) {
        uint256 tokenPriceInWETH = getAqtisPriceInWETH();
        int wethPriceInUSD = getLatestEthPrice();

        return tokenPriceInWETH * uint256(wethPriceInUSD) / 1e8;
    }

    /// @notice Returns ETH Price in USD (8 decimals)
    function getLatestEthPrice() public view returns (int) {
        (,int price,,uint updatedAt,) = priceFeedEth.latestRoundData();
        require(updatedAt >= block.timestamp - stalePeriod[address(priceFeedEth)], "TokenPriceCalculator: price feed is stale");
        return price;
    }

    /// @notice Returns USDC Price in USD (8 decimals)
    function getLatestUsdPrice() public view returns (int) {
        (,int price,,uint updatedAt,) = priceFeedUsd.latestRoundData();
        require(updatedAt >= block.timestamp - stalePeriod[address(priceFeedUsd)], "TokenPriceCalculator: price feed is stale");
        return price;
    }

    // ======= Owner Functions ======= //
    function setStalePeriod(address priceFeed, uint _stalePeriod) external onlyOwner {
        emit StalePeriodSet(address(priceFeed), stalePeriod[address(priceFeed)], _stalePeriod);
        stalePeriod[priceFeed] = _stalePeriod;
    }

    function setPriceInterval(uint _priceInterval) external onlyOwner {
        priceInterval = _priceInterval;
    }
}