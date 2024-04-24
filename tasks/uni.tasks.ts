import { task } from "hardhat/config";
import {
  UNISWAP_FACTORY_ADDRESSES,
  UNISWAP_V2_FACTORY_ADDRESSES,
  UNISWAP_V2_ROUTER_ADDRESSES, USDC_ADDRESSES,
  WETH_ADDRESSES
} from "../constants";
import { ContractTransactionResponse } from "ethers";
import { getLSTAddress } from "./utils";

task("create:v2-pool-liquidity", "Create a v2 pool")
  .addParam<string>("tokenA", "Address of token A")
  .addParam<string>("tokenB", "Address of token B")
  .addParam<string>("amountA", "Amount of token A")
  .addParam<string>("amountB", "Amount of token B")
  .setAction(async (taskArgs: {
    tokenA: string,
    tokenB: string,
    amountA: string,
    amountB: string,
  }, {ethers}) => {
    let chainId = await ethers.provider.getNetwork().then(network => network.chainId);
    console.log("chainId: ", chainId.toString());
    console.log("factory address: ", UNISWAP_V2_FACTORY_ADDRESSES[Number(chainId)]);

    const tokenA = await ethers.getContractAt("ERC20", taskArgs.tokenA);
    const tokenB = await ethers.getContractAt("ERC20", taskArgs.tokenB);
    const amountA = ethers.parseUnits(taskArgs.amountA, await tokenA.decimals());
    const amountB = ethers.parseUnits(taskArgs.amountB, await tokenB.decimals());
    const signer = (await ethers.getSigners())[0];
    const balanceA = await tokenA.balanceOf(signer.getAddress());
    const balanceB = await tokenB.balanceOf(signer.getAddress());
    const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER_ADDRESSES[Number(chainId)]);
    console.log("tokenA: ", await tokenA.symbol());
    console.log("amountA: ", amountA.toString());
    console.log("tokenA balance: ", balanceA.toString());

    console.log("tokenB: ", await tokenB.symbol());
    console.log("amountB: ", amountB.toString());
    console.log("tokenB balance: ", balanceB.toString());

    if (amountA > balanceA) {
      console.log("insufficient balance for token A");
      return;
    }

    if (amountB > balanceB) {
      console.log("insufficient balance for token B");
      return;
    }

    let tx: ContractTransactionResponse;

    if (await tokenA.allowance(signer.getAddress(), router.getAddress()) < amountA) {
      console.log("approving");
      let tx = await tokenA.approve(router.getAddress(), ethers.MaxUint256);
      console.log("submitted tx with hash: ", tx.hash);
      console.log("waiting for confirmation...");
      await tx.wait();
    }

    if (await tokenB.allowance(signer.getAddress(), router.getAddress()) < amountB) {
      console.log("approving");
      tx = await tokenB.approve(router.getAddress(), ethers.MaxUint256);
      console.log("submitted tx with hash: ", tx.hash);
      console.log("waiting for confirmation...");
      await tx.wait();
    }

    tx = await router.addLiquidity(
      taskArgs.tokenA,
      taskArgs.tokenB,
      amountA,
      amountB,
      amountA * 900n / 1000n,
      amountB * 900n / 1000n,
      signer.getAddress(),
      9920170954,
    )
    console.log("submitted tx with hash: ", tx.hash);
    console.log("waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("confirmed tx in block: ", receipt?.blockNumber);

    const factory = await ethers.getContractAt("IUniswapV2Factory", await router.factory());
    let pair = await factory.getPair(taskArgs.tokenA, taskArgs.tokenB);
    console.log("pair created: ", pair);
  });

task("list:v2-pool", "List a v2 pool")
  .addParam<string>("tokenA", "Address of token A")
  .addParam<string>("tokenB", "Address of token B")
  .setAction(async (taskArgs: {
    tokenA: string,
    tokenB: string,
  }, {ethers}) => {
    let chainId = await ethers.provider.getNetwork().then(network => network.chainId);
    console.log("chainId: ", chainId.toString());
    console.log("factory address: ", UNISWAP_V2_FACTORY_ADDRESSES[Number(chainId)]);
    const factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_V2_FACTORY_ADDRESSES[Number(chainId)]);

    console.log("pair: ", await factory.getPair(taskArgs.tokenA, taskArgs.tokenB));
  });

task("list:v2-factory", "List a v2 router")
  .setAction(async (taskArgs: {}, {ethers}) => {
    let chainId = await ethers.provider.getNetwork().then(network => network.chainId);
    console.log("chainId: ", chainId.toString());
    const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER_ADDRESSES[Number(chainId)]);
    console.log("router: ", await router.getAddress());
    console.log("factory: ", await router.factory());
  });


task("list:v3-pools", "List v3 pools")
  .setAction(async (taskArgs: {}, {ethers, deployments}) => {
    const chainId = Number(await ethers.provider.getNetwork().then(network => network.chainId));
    const claimVault = await ethers.getContractAt("ClaimVault", (await deployments.get("ClaimVault")).address);
    for (let lst of ["QSD", "QRT", "QETH"]) {
      const lstAddress = await getLSTAddress(deployments, lst as "QSD" | "QRT" | "QETH");
      const factoryAddress = UNISWAP_FACTORY_ADDRESSES[chainId];
      const WETH = WETH_ADDRESSES[chainId];
      const USDC = USDC_ADDRESSES[chainId];
      const factory = await ethers.getContractAt("IUniswapV3Factory", factoryAddress);
      const poolUSDC = await factory.getPool(lstAddress, USDC, 3000);
      const poolWETH = await factory.getPool(lstAddress, WETH, 3000);
      console.log(`LST: ${lst}`);
      const wethPool = await claimVault.wethPairs(lstAddress);
      const usdcPool = await claimVault.usdcPairs(lstAddress);
      console.log(`\tUSDC pool: ${poolUSDC}`);
      console.log(`\t\tconfigured: ${usdcPool}`);
      console.log(`\tWETH pool: ${poolWETH}`);
      console.log(`\t\tconfigured: ${wethPool}`);
    }
  });

task("set:v3-pool-cardinality", "Set the observation cardinality for a v3 pool")
  .addParam<string>("pool", "Address of the pool")
  .addParam<number>("cardinality", "Observation cardinality")
  .setAction(async (taskArgs: {
    pool: string,
    cardinality: number,
  }, {ethers}) => {
    const pool = await ethers.getContractAt("IUniswapV3Pool", taskArgs.pool);
    let tx = await pool.increaseObservationCardinalityNext(taskArgs.cardinality);
    console.log("submitted tx with hash: ", tx.hash);
    console.log("waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("confirmed tx in block: ", receipt?.blockNumber);
  });