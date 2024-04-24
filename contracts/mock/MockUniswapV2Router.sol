// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {TransferHelper} from "../external/uniswap/TransferHelper.sol";
import {IUniswapV2Pair} from "../external/uniswap/interfaces/IUniswapV2Pair.sol";
import {ISwapRouter} from "../external/uniswap/interfaces/ISwapRouter.sol";

contract MockUniswapV2Router {

    function swapExactTokensForTokens(
        IUniswapV2Pair pair,
        address tokenIn,
        uint amountIn,
        uint amountOutMin
    ) external returns (uint) {
        (uint reserve0, uint reserve1,) = pair.getReserves();
        (uint reserveIn, uint reserveOut) = tokenIn == pair.token0() ? (reserve0, reserve1) : (reserve1, reserve0);
        uint amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(pair), amountIn);

        (uint amount0Out, uint amount1Out) = tokenIn == pair.token0() ? (uint(0), amountOut) : (amountOut, uint(0));

        pair.swap(amount0Out, amount1Out, msg.sender, new bytes(0));

        return amountOut;
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
}