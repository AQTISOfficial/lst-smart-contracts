import { ethers } from "hardhat";
import { IERC20, INonfungiblePositionManager, IUniswapV2Pair, IUniswapV3Pool } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

export const UNISWAP_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
export const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const NONFUNGIBLE_POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
export const RICH_ADDRESS = "0x28C6c06298d514Db089934071355E5743bf21d60";
export const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
export const USDC_USD_FEED = "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6";

export const AQTIS_ADDRESS = "0x6FF2241756549B5816A177659E766EAf14B34429";
export const AQTIS_POOL_ADDRESS = "0xb777d386a9f6bf14ff85d92b27dc70209141e787";

export async function initializePool(
  positionManager: INonfungiblePositionManager,
  tokenA: IERC20,
  tokenB: IERC20,
  sqrtPriceX96: bigint,
  amountTokenA: bigint,
): Promise<{
  pool: IUniswapV3Pool
}> {
  let amountTokenB = sqrtPriceX96 * sqrtPriceX96 * amountTokenA / 2n ** 192n;

  if ((await tokenA.getAddress()).toLowerCase() > (await tokenB.getAddress()).toLowerCase()) {
    [tokenA, tokenB] = [tokenB, tokenA];
    [amountTokenA, amountTokenB] = [amountTokenB, amountTokenA];
    sqrtPriceX96 = 2n ** 192n / sqrtPriceX96;
  }

  const poolTx = await positionManager.createAndInitializePoolIfNecessary(
    tokenA,
    tokenB,
    3000,
    sqrtPriceX96
  );
  await poolTx.wait();

  const factory = await ethers.getContractAt("IUniswapV3Factory", UNISWAP_FACTORY);
  const poolAddress = await factory.getPool(tokenA.getAddress(), tokenB.getAddress(), 3000);
  const signer = await ethers.getImpersonatedSigner(RICH_ADDRESS);

  await tokenA.connect(signer).approve(positionManager.getAddress(), ethers.MaxUint256);
  await tokenB.connect(signer).approve(positionManager.getAddress(), ethers.MaxUint256);

  const mintTx = await positionManager.connect(signer).mint({
    token0: tokenA,
    token1: tokenB,
    fee: 3000,
    tickLower: -887220,
    tickUpper: 887220,
    amount0Desired: amountTokenA,
    amount1Desired: amountTokenB,
    amount0Min: 0,
    amount1Min: 0,
    recipient: RICH_ADDRESS,
    deadline: 9920170954, // very far away
  });

  await mintTx.wait();

  const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
  await pool.increaseObservationCardinalityNext(10);

  // do some swaps
  const tokenIn = await pool.token0() === WETH_ADDRESS || await pool.token1() === WETH_ADDRESS ? WETH_ADDRESS : USDC_ADDRESS;
  const tokenOut = tokenIn === await tokenA.getAddress() ? await tokenB.getAddress() : await tokenA.getAddress();

  await tokenA.connect(signer).approve(UNISWAP_ROUTER, ethers.MaxUint256);
  await tokenB.connect(signer).approve(UNISWAP_ROUTER, ethers.MaxUint256);

  const swapRouter = await ethers.getContractAt("ISwapRouter", UNISWAP_ROUTER);
  await swapRouter.connect(signer).exactInputSingle({
    tokenIn,
    tokenOut,
    fee: 3000,
    recipient: RICH_ADDRESS,
    deadline: 9920170954, // very far away
    amountIn: ethers.parseUnits("1", tokenIn === WETH_ADDRESS ? 18 : 6),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  });

  // wait
  await time.increase(60 * 30); // 30 minutes

  await swapRouter.connect(signer).exactInputSingle({
    tokenIn,
    tokenOut,
    fee: 3000,
    recipient: RICH_ADDRESS,
    deadline: 9920170954, // very far away
    amountIn: ethers.parseUnits("1", tokenIn === WETH_ADDRESS ? 18 : 6),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  });

  // wait
  await time.increase(60 * 30); // 30 minutes

  return {pool};
}

async function swapForETHOrUSDC() {

}


export function sqrt(value: bigint): bigint {
  if (value < 0n) {
    throw "square root of negative numbers is not supported"
  }

  if (value < 2n) {
    return value;
  }

  function newtonIteration(n: bigint, x0: bigint): bigint {
    const x1 = ((n / x0) + x0) >> 1n;
    if (x0 === x1 || x0 === (x1 - 1n)) {
      return x0;
    }
    return newtonIteration(n, x1);
  }

  return newtonIteration(value, 1n);
}
