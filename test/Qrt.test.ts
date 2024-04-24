import { Qrt } from "../typechain-types";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { AQTIS_ADDRESS, AQTIS_POOL_ADDRESS, ETH_USD_FEED, RICH_ADDRESS, USDC_ADDRESS, USDC_USD_FEED } from "./utils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import * as process from "process";

describe("Qrt - Basics", () => {
  const deployFixture = async (): Promise<{ qrt: Qrt }> => {
    const qrt = await (await ethers.getContractFactory("Qrt")).deploy(ethers.ZeroAddress);
    return {qrt};
  }
  it("should deploy", async () => {
    const {qrt} = await deployFixture();
    expect(await qrt.getAddress()).to.be.not.undefined;
  });

  it("should have a name", async () => {
    const {qrt} = await deployFixture();
    expect(await qrt.name()).to.equal("Quant Reserve Token");
  });

  it("should have a symbol", async () => {
    const {qrt} = await deployFixture();
    expect(await qrt.symbol()).to.equal("QRT");
  });

  it("should have 6 decimals", async () => {
    const {qrt} = await deployFixture();
    expect(await qrt.decimals()).to.equal(6);
  });

  it("should have a total supply", async () => {
    const {qrt} = await deployFixture();
    expect(await qrt.totalSupply()).to.equal(0);
  });

  it("should have a soft cap", async () => {
    const {qrt} = await deployFixture();
    expect(await qrt.cap()).to.equal(100_000_000n * 10n ** 6n);
  });

  it("should have 17.5% apy", async () => {
    const {qrt} = await deployFixture();
    const apy = await qrt.apy();
    const denominator = await qrt.DENOMINATOR();
    expect(Number(apy) / Number(denominator)).to.equal(0.175);
  });

  it("should have 2.5% aqtis apy", async () => {
    const {qrt} = await deployFixture();
    const apy = await qrt.aqtisApy();
    const denominator = await qrt.DENOMINATOR();
    expect(Number(apy) / Number(denominator)).to.equal(0.025);
  });
});

describe("Qrt - Minting", () => {
  before(async () => {
    // setup the network
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.MAINNET_ALCHEMY_API_KEY}`,
          blockNumber: 19275880,
        }
      }]
    });
  });

  const deployFixture = async () => {
    const qrt = await (await ethers.getContractFactory("Qrt")).deploy(USDC_ADDRESS);
    await qrt.setBuyActive(true);
    const distributorAddress = await ethers.getSigners().then(signer => signer[1].getAddress());
    await qrt.setDistributionAddress(distributorAddress);
    const tokenPriceCalculator = await (await ethers.getContractFactory("TokenPriceCalculator")).deploy(
      AQTIS_POOL_ADDRESS,
      ETH_USD_FEED,
      USDC_USD_FEED,
      AQTIS_ADDRESS
    );

    // initialize token price calculator
    await time.increase(60 * 60 * 25);
    await tokenPriceCalculator.update();
    await time.increase(60 * 60 * 25);
    await tokenPriceCalculator.update();

    await qrt.setTokenPriceCalculator(tokenPriceCalculator.getAddress());
    await tokenPriceCalculator.setStalePeriod(ETH_USD_FEED, 60 * 60 * 24 * 7);
    await tokenPriceCalculator.setStalePeriod(USDC_USD_FEED, 60 * 60 * 24 * 7);
    return {qrt, tokenPriceCalculator};
  }

  it("should deploy", async () => {
    const {qrt} = await loadFixture(deployFixture);
    expect(await qrt.getAddress()).to.be.not.undefined;
  });

  it("should be able to buy with usdc", async () => {
    const {qrt, tokenPriceCalculator} = await loadFixture(deployFixture);
    const signer = await ethers.getImpersonatedSigner(RICH_ADDRESS);
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    await usdc.connect(signer).approve(qrt.getAddress(), ethers.MaxUint256);

    const usdPrice = await tokenPriceCalculator.getLatestUsdPrice();
    const amountIn = ethers.parseUnits("100", 6);
    // mint price qrt is 10 USD
    const amountOut = amountIn * usdPrice / (10n ** 8n * 10n);

    const balanceBefore = await qrt.balanceOf(await signer.getAddress());
    const usdcBalanceBefore = await usdc.balanceOf(await signer.getAddress());
    await qrt.connect(signer).buyTokens(amountIn);
    const balanceAfter = await qrt.balanceOf(await signer.getAddress());
    const usdcBalanceAfter = await usdc.balanceOf(await signer.getAddress());

    expect(balanceAfter - balanceBefore).to.equal(amountOut);
    expect(usdcBalanceBefore - usdcBalanceAfter).to.equal(amountIn);
  });

  it("should be able to buy with eth", async () => {
    const {qrt, tokenPriceCalculator} = await loadFixture(deployFixture);
    const signer = await ethers.getImpersonatedSigner(RICH_ADDRESS);
    const ethPrice = await tokenPriceCalculator.getLatestEthPrice();
    const amountIn = ethers.parseEther("1");
    const amountOut = amountIn * ethPrice / (10n ** 8n * 10n * 10n ** 12n);

    const balanceBefore = await qrt.balanceOf(await signer.getAddress());
    const ethBalanceBefore = await ethers.provider.getBalance(await signer.getAddress());
    const tx = await qrt.connect(signer).buyTokensWithEth({value: amountIn});
    const balanceAfter = await qrt.balanceOf(await signer.getAddress());
    const ethBalanceAfter = await ethers.provider.getBalance(await signer.getAddress());

    expect(balanceAfter - balanceBefore).to.equal(amountOut);
    expect(ethBalanceBefore - ethBalanceAfter).to.be.lt(amountIn + tx.gasPrice * tx.gasLimit);
  });
});