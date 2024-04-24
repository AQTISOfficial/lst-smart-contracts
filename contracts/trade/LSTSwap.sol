// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {TickMath} from "../external/uniswap/libraries/TickMath.sol";
import {IUniswapV3Pool} from "../external/uniswap/interfaces/IUniswapV3Pool.sol";
import {TransferHelper} from "../external/uniswap/TransferHelper.sol";

import {UniswapV3OracleLibrary} from "../lib/UniswapV3OracleLibrary.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {ILST} from "../interfaces/ILST.sol";

/**
 * @title LST Swap Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract handles swapping LSTs for rewards
 */

contract LSTSwap {
    using Address for address;
    using SafeCast for uint256;

    // ======= Dependencies ======= //
    address public factory;
    address public immutable usdc;
    address public immutable weth;

    // ======= State Variables ======= //
    uint24 internal timeWeightedAveragePeriod = 1800; // 30 minutes
    uint256 public constant Q64 = 2 ** 64;
    uint256 internal minOutFractionQ64 = 97 * Q64 / 100; // 97%

    mapping(address => address) public wethPairs;
    mapping(address => address) public usdcPairs;

    struct SwapCallbackData {
        address tokenIn;
        address tokenOut;
        uint256 amountInMax;
    }

    // ======= Events ======= //
    event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(address _factory, address _usdc, address _weth) {
        usdc = _usdc;
        weth = _weth;
        factory = _factory;
    }

    // ======= Internal Functions ======= //

    // @notice Mints LST for the exact output amount of ETH
    // @param lst The LST address
    // @param amountOut The amount of ETH to receive
    function _mintForExactOutETH(address lst, uint256 amountOut) internal {
        require(wethPairs[lst] != address(0), "LSTSwap: Pair not found");
        uint mintMax = _calculateMaxInWETH(lst, amountOut);
        _exactOutputInternal(IUniswapV3Pool(wethPairs[lst]), lst, weth, mintMax, amountOut);
    }

    // @notice Mints LST for the exact output amount of USDC
    // @param lst The LST address
    // @param amountOut The amount of USDC to receive
    function _mintForExactOutUSDC(address lst, uint256 amountOut) internal {
        require(usdcPairs[lst] != address(0), "LSTSwap: Pair not found");
        uint mintMax = _calculateMaxInUSDC(lst, amountOut);
        _exactOutputInternal(IUniswapV3Pool(usdcPairs[lst]), lst, usdc, mintMax, amountOut);
    }

    // @notice Mints an exact amount of LST to a variable amount of ETH
    // @param lst The LST address
    // @param amountIn The amount of LST to mint
    function _mintWithExactInETH(address lst, uint256 amountIn) internal returns (uint){
        require(wethPairs[lst] != address(0), "LSTSwap: Pair not found");
        uint amountOutMin = _calculateMinOutWETH(lst, amountIn);
        return _exactInputInternal(IUniswapV3Pool(wethPairs[lst]), lst, weth, amountIn, amountOutMin);
    }

    // @notice Mints an exact amount of LST to a variable amount of USDC
    // @param lst The LST address
    // @param amountIn The amount of LST to mint
    function _mintWithExactInUSDC(address lst, uint256 amountIn) internal returns (uint){
        require(usdcPairs[lst] != address(0), "LSTSwap: Pair not found");
        uint amountOutMin = _calculateMinOutUSDC(lst, amountIn);
        return _exactInputInternal(IUniswapV3Pool(usdcPairs[lst]), lst, usdc, amountIn, amountOutMin);
    }

    // @notice Initializes a swap from tokenIn to tokenOut
    /// @dev Performs a single exact input swap
    // @param pool The Uniswap V3 pool
    // @param tokenIn The token to swap from
    // @param tokenOut The token to swap to
    // @param amountIn The amount of tokenIn to swap
    // @param amountOutMin The minimum amount of tokenOut to receive
    function _exactInputInternal(
        IUniswapV3Pool pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal returns (uint256 amountOut) {

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0Delta, int256 amount1Delta) = pool.swap(
            address(this),
            zeroForOne,
            amountIn.toInt256(),
            zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1,
            abi.encode(
                SwapCallbackData({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    amountInMax: amountIn
                })
            )
        );

        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne
            ? (uint256(amount0Delta), uint256(- amount1Delta))
            : (uint256(amount1Delta), uint256(- amount0Delta));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        require(amountOutReceived > amountOutMin, "LSTSwap: Insufficient output amount");

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOutReceived);
        return uint256(- (zeroForOne ? amount1Delta : amount0Delta));
    }

    // @notice Initializes a swap from tokenIn to tokenOut
    // @dev Performs a single exact output swap
    function _exactOutputInternal(
        IUniswapV3Pool pool,
        address tokenIn,
        address tokenOut,
        uint256 amountInMax,
        uint256 amountOut
    ) internal returns (uint256 amountIn) {

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0Delta, int256 amount1Delta) = pool.swap(
            address(this),
            zeroForOne,
            - amountOut.toInt256(),
            zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1,
            abi.encode(
                SwapCallbackData({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    amountInMax: amountInMax
                })
            )
        );

        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne
            ? (uint256(amount0Delta), uint256(- amount1Delta))
            : (uint256(amount1Delta), uint256(- amount0Delta));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        require(amountOutReceived == amountOut);

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOutReceived);
    }

    // @notice Callback called from Uniswap contracts to finalize a swap
    // @param amount0Delta The change in token0
    // @param amount1Delta The change in token1
    // @param _data The encoded swap callback data
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata _data
    ) external {
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        require(msg.sender == usdcPairs[data.tokenIn] || msg.sender == wethPairs[data.tokenIn], "LSTSwap: Invalid sender");
        (address tokenIn, address tokenOut) = (data.tokenIn, data.tokenOut);

        (bool isExactInput, uint256 amountToPay) =
            amount0Delta > 0
                ? (tokenIn < tokenOut, uint256(amount0Delta))
                : (tokenOut < tokenIn, uint256(amount1Delta));

        require(amountToPay <= data.amountInMax, "LSTSwap: Exceeded max mint");
        if (isExactInput) {
            pay(tokenIn, msg.sender, amountToPay);
        } else {
            tokenIn = tokenOut; // swap in/out because exact output swaps are reversed
            pay(tokenIn, msg.sender, amountToPay);
        }
    }

    function pay(address token, address receiver, uint256 amount) private {
        ILST(token).mint(amount);
        TransferHelper.safeTransfer(token, receiver, amount);
    }

    // ======= Admin Functions ======= //

    function _setWethPair(address lst, address pair) internal {
        require(IUniswapV3Pool(pair).token0() == weth || IUniswapV3Pool(pair).token1() == weth, "LSTSwap: Invalid pair");
        require(IUniswapV3Pool(pair).token0() == lst || IUniswapV3Pool(pair).token1() == lst, "LSTSwap: Invalid pair");
        wethPairs[lst] = pair;
    }

    function _setUsdcPair(address lst, address pair) internal {
        require(IUniswapV3Pool(pair).token0() == usdc || IUniswapV3Pool(pair).token1() == usdc, "LSTSwap: Invalid pair");
        require(IUniswapV3Pool(pair).token0() == lst || IUniswapV3Pool(pair).token1() == lst, "LSTSwap: Invalid pair");
        usdcPairs[lst] = pair;
    }

    function _setTimeWeightedAveragePeriod(uint24 period) internal {
        timeWeightedAveragePeriod = period;
    }

    function _setMinOutFractionQ64(uint256 fraction) internal {
        minOutFractionQ64 = fraction;
    }

    function _updateFactory(address _factory) internal {
        factory = _factory;
    }

    // needed to unwrap WETH
    receive() external payable {}

    // ======= Oracle Functions ======= //
    enum PairType {WETH, USDC}

    function _getQuoteExactIn(address lst, uint256 amountIn, PairType pairType) internal view returns (uint256){
        address pair = pairType == PairType.WETH ? wethPairs[lst] : usdcPairs[lst];
        require(pair != address(0), "LSTSwap: Pair not found");
        address quoteCurrency = pairType == PairType.WETH ? weth : usdc;
        (int24 tick,) = UniswapV3OracleLibrary.consult(pair, timeWeightedAveragePeriod);
        return UniswapV3OracleLibrary.getQuoteAtTick(tick, amountIn.toUint128(), lst, quoteCurrency);
    }

    function _getQuoteExactOut(address lst, uint256 amountOut, PairType pairType) internal view returns (uint256){
        address pair = pairType == PairType.WETH ? wethPairs[lst] : usdcPairs[lst];
        require(pair != address(0), "LSTSwap: Pair not found");
        address quoteCurrency = pairType == PairType.WETH ? weth : usdc;
        (int24 tick,) = UniswapV3OracleLibrary.consult(pair, timeWeightedAveragePeriod);
        return UniswapV3OracleLibrary.getQuoteAtTick(tick, amountOut.toUint128(), quoteCurrency, lst);
    }

    function _calculateMinOutWETH(address lst, uint256 amountIn) internal view returns (uint256){
        uint quoteAmount = _getQuoteExactIn(lst, amountIn, PairType.WETH);
        return minOutFractionQ64 * quoteAmount / Q64;
    }

    function _calculateMinOutUSDC(address lst, uint256 amountIn) internal view returns (uint256){
        uint quoteAmount = _getQuoteExactIn(lst, amountIn, PairType.USDC);
        return minOutFractionQ64 * quoteAmount / Q64;
    }

    function _calculateMaxInWETH(address lst, uint256 amountOut) internal view returns (uint256){
        uint quoteAmount = _getQuoteExactOut(lst, amountOut, PairType.WETH);
        return quoteAmount * Q64 / minOutFractionQ64;
    }

    function _calculateMaxInUSDC(address lst, uint256 amountOut) internal view returns (uint256){
        uint quoteAmount = _getQuoteExactOut(lst, amountOut, PairType.USDC);
        return quoteAmount * Q64 / minOutFractionQ64;
    }
}