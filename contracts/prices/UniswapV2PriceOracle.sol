// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {UniswapV2OracleLibrary} from "../lib/UniswapV2OracleLibrary.sol";
import {FixedPoint} from "../external/uniswap/libraries/FixedPoint.sol";
import {IUniswapV2Pair} from "../external/uniswap/interfaces/IUniswapV2Pair.sol";

/**
 * @title Token Oracle for the Aqtis Token on Uniswap V2 Pair Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract provides price information for AQTIS token
 */

contract UniswapV2PriceOracle {
    using FixedPoint for *;

    uint public priceInterval = 24 hours;

    IUniswapV2Pair public immutable pair;
    address public immutable token0;
    address public immutable token1;

    uint    public price0CumulativeLast;
    uint    public price1CumulativeLast;
    uint32  public blockTimestampLast;

    FixedPoint.uq112x112 public price0Average;
    FixedPoint.uq112x112 public price1Average;

    // ======= Events ======= //
    event PriceIntervalSet(uint oldInterval, uint newInterval);
    event PriceUpdated(uint112 price0, uint112 price1);

    constructor(address pairAddress) {
        IUniswapV2Pair _pair = IUniswapV2Pair(pairAddress);
        pair = _pair;
        token0 = _pair.token0();
        token1 = _pair.token1();
        price0CumulativeLast = _pair.price0CumulativeLast(); // fetch the current accumulated price value (1 / 0)
        price1CumulativeLast = _pair.price1CumulativeLast(); // fetch the current accumulated price value (0 / 1)
        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, blockTimestampLast) = _pair.getReserves();
        require(reserve0 != 0 && reserve1 != 0, 'V2Oracle: NO_RESERVES'); // ensure that there's liquidity in the pair
    }

    // @notice Update the moving price average for the uniswap V2 pair
    // @dev This function can be called by anyone, but should be called at least once every 24 hours
    function update() external {
        (uint price0Cumulative, uint price1Cumulative, uint32 blockTimestamp) =
                            UniswapV2OracleLibrary.currentCumulativePrices(address(pair));
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired

        // ensure that at least one full period has passed since the last update
        require(timeElapsed >= priceInterval, 'V2Oracle: PERIOD_NOT_ELAPSED');

        // overflow is desired, casting never truncates
        // cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
        price0Average = FixedPoint.uq112x112(uint224((price0Cumulative - price0CumulativeLast) / timeElapsed));
        price1Average = FixedPoint.uq112x112(uint224((price1Cumulative - price1CumulativeLast) / timeElapsed));

        price0CumulativeLast = price0Cumulative;
        price1CumulativeLast = price1Cumulative;
        blockTimestampLast = blockTimestamp;

        emit PriceUpdated(price0Average.decode(), price1Average.decode());
    }

    // @notice Get the price of a token in terms of the other token in the pair
    // @param token The address of the token to get the price of
    // @param amountIn The amount of the token to get the price of
    // note this will always return 0 before update has been called successfully for the first time.
    function consult(address token, uint amountIn) public view returns (uint amountOut) {
        if (token == token0) {
            amountOut = price0Average.mul(amountIn).decode144();
        } else {
            require(token == token1, 'V2Oracle: INVALID_TOKEN');
            amountOut = price1Average.mul(amountIn).decode144();
        }
    }

    // @notice Get the price of a token in terms of the other token in the pair
    // @dev This function assumes that 1e18 is equal to 1 token
    // @param token The address of the token to get the price of
    function getPrice(address token) public view returns (uint) {
        // this only works because WETH and AQTIS have 18 decimals
        return consult(token, 1e18);
    }

    // ======= Internal Functions ======= //
    function _setPriceInterval(uint _interval) internal {
        emit PriceIntervalSet(priceInterval, _interval);
        priceInterval = _interval;
    }
}