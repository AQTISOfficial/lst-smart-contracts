## Price Calculator

In order to calculate the value of rewards tokens, and to ensure that LST minting prices are correctly calculated, we have implemented a price calculator contract. This contract is responsible for fetching the price of tokens from the Chainlink Oracle, as well as tracking the price of AQTIS tokens on the official Uniswap V2 pool.

### Price Calculation
In order to maintain a correct price for the AQTIS token we need to take a moving average of the AQTIS token price over a defined interval. Currently, that interval is set to 24 hours.

The Token price calculator interface looks as such:
```solidity
interface ITokenPriceCalculator {
    function update() external;
    function getAqtisPriceInWETH() external view returns (uint256);
    function getAqtisPriceInUSD() external view returns (uint256);
    function getLatestUsdPrice() external view returns (uint256);
    function getLatestEthPrice() external view returns (uint256);
}
```

The `update()` function needs to be called every 24 hours (or predefined interval) in order to keep the price relevant.
