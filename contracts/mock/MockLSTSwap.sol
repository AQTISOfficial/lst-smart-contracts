// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {LSTSwap} from "../trade/LSTSwap.sol";
import {IUniswapV3Pool} from "../external/uniswap/interfaces/IUniswapV3Pool.sol";

contract MockLSTSwap is LSTSwap {
    constructor(address _factory, address _usdc, address _weth) LSTSwap(_factory, _usdc, _weth){}

    function setWETHPair(address lst, address pair) external {
        _setWethPair(lst, pair);
    }

    function setUSDCPair(address lst, address pair) external {
        _setUsdcPair(lst, pair);
    }

    function mintForExactOutETH(address lst, uint256 amountOut) external {
        _mintForExactOutETH(lst, amountOut);
    }

    function mintForExactOutUSDC(address lst, uint256 amountOut) external {
        _mintForExactOutUSDC(lst, amountOut);
    }

    function mintWithExactInETH(address lst, uint256 amountIn) external {
        _mintWithExactInETH(lst, amountIn);
    }

    function mintWithExactInUSDC(address lst, uint256 amountIn) external {
        _mintWithExactInUSDC(lst, amountIn);
    }

    function exactInputInternal(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut) {
        return _exactInputInternal(IUniswapV3Pool(pool), tokenIn, tokenOut, amountIn, amountOutMin);
    }

    function exactOutputInternal(
        IUniswapV3Pool pool,
        address tokenIn,
        address tokenOut,
        uint256 amountInMax,
        uint256 amountOut
    ) external returns (uint256 amountIn) {
        return _exactOutputInternal(pool, tokenIn, tokenOut, amountInMax, amountOut);
    }

    function calculateMinOutWETH(address lst, uint256 amountIn) external view returns (uint256){
        return _calculateMinOutWETH(lst, amountIn);
    }

    function calculateMinOutUSDC(address lst, uint256 amountIn) external view returns (uint256){
        return _calculateMinOutUSDC(lst, amountIn);
    }

    function calculateMaxInWETH(address lst, uint256 amountOut) external view returns (uint256){
        return _calculateMaxInWETH(lst, amountOut);
    }

    function calculateMaxInUSDC(address lst, uint256 amountOut) external view returns (uint256){
        return _calculateMaxInUSDC(lst, amountOut);
    }
}