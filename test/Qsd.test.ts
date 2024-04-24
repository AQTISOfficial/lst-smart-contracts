import { Qsd } from "../typechain-types";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { AQTIS_ADDRESS, AQTIS_POOL_ADDRESS, ETH_USD_FEED, RICH_ADDRESS, USDC_ADDRESS, USDC_USD_FEED } from "./utils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Qsd - Basics", () => {
  const deployFixture = async (): Promise<{ qsd: Qsd }> => {
    const qsd = await (await ethers.getContractFactory("Qsd")).deploy(ethers.ZeroAddress);
    return {qsd};
  }
  it("should deploy", async () => {
    const {qsd} = await deployFixture();
    expect(await qsd.getAddress()).to.be.not.undefined;
  });

  it("should have a name", async () => {
    const {qsd} = await deployFixture();
    expect(await qsd.name()).to.equal("Quant State Dollar");
  });

  it("should have a symbol", async () => {
    const {qsd} = await deployFixture();
    expect(await qsd.symbol()).to.equal("QSD");
  });

  it("should have 6 decimals", async () => {
    const {qsd} = await deployFixture();
    expect(await qsd.decimals()).to.equal(6);
  });

  it("should have a total supply", async () => {
    const {qsd} = await deployFixture();
    expect(await qsd.totalSupply()).to.equal(0);
  });

  it("should have a soft cap", async () => {
    const {qsd} = await deployFixture();
    expect(await qsd.cap()).to.equal(1_000_000_000n * 10n ** 6n);
  });

  it("should have 15% apy", async () => {
    const {qsd} = await deployFixture();
    const apy = await qsd.apy();
    const denominator = await qsd.DENOMINATOR();
    expect(Number(apy) / Number(denominator)).to.equal(0.15);
  });

  it("should have 2.5% aqtis apy", async () => {
    const {qsd} = await deployFixture();
    const apy = await qsd.aqtisApy();
    const denominator = await qsd.DENOMINATOR();
    expect(Number(apy) / Number(denominator)).to.equal(0.025);
  });
});


describe("Qsd - Minting", () => {
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
    const qsd = await (await ethers.getContractFactory("Qsd")).deploy(USDC_ADDRESS);
    await qsd.setBuyActive(true);
    const distributorAddress = await ethers.getSigners().then(signer => signer[1].getAddress());
    await qsd.setDistributionAddress(distributorAddress);
    const tokenPriceCalculator = await (await ethers.getContractFactory("TokenPriceCalculator")).deploy(
      AQTIS_POOL_ADDRESS,
      ETH_USD_FEED,
      USDC_USD_FEED,
      AQTIS_ADDRESS
    );
    await tokenPriceCalculator.setStalePeriod(ETH_USD_FEED, 60 * 60 * 24 * 7);
    await tokenPriceCalculator.setStalePeriod(USDC_USD_FEED, 60* 60 * 24 * 7);

    // initialize token price calculator
    await time.increase(60 * 60 * 25);
    await tokenPriceCalculator.update();
    await time.increase(60 * 60 * 25);
    await tokenPriceCalculator.update();

    await qsd.setTokenPriceCalculator(tokenPriceCalculator.getAddress());
    return {qsd, tokenPriceCalculator};
  }

  it("should deploy", async () => {
    const {qsd} = await loadFixture(deployFixture);
    expect(await qsd.getAddress()).to.be.not.undefined;
  });

  it("should be able to buy with usdc", async () => {
    const {qsd, tokenPriceCalculator} = await loadFixture(deployFixture);
    const signer = await ethers.getImpersonatedSigner(RICH_ADDRESS);
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    await usdc.connect(signer).approve(qsd.getAddress(), ethers.MaxUint256);

    const usdPrice = await tokenPriceCalculator.getLatestUsdPrice();
    const amountIn = ethers.parseUnits("100", 6);
    // mint price qsd is 1 USD
    const amountOut = amountIn * usdPrice / (10n ** 8n);

    const balanceBefore = await qsd.balanceOf(await signer.getAddress());
    const usdcBalanceBefore = await usdc.balanceOf(await signer.getAddress());
    await qsd.connect(signer).buyTokens(amountIn);
    const balanceAfter = await qsd.balanceOf(await signer.getAddress());
    const usdcBalanceAfter = await usdc.balanceOf(await signer.getAddress());

    expect(balanceAfter - balanceBefore).to.equal(amountOut);
    expect(usdcBalanceBefore - usdcBalanceAfter).to.equal(amountIn);
  });

  it("should be able to buy with eth", async () => {
    const {qsd, tokenPriceCalculator} = await loadFixture(deployFixture);
    const signer = await ethers.getImpersonatedSigner(RICH_ADDRESS);
    const ethPrice = await tokenPriceCalculator.getLatestEthPrice();
    const amountIn = ethers.parseEther("1");
    const amountOut = amountIn * ethPrice / (10n ** 8n * 10n ** 12n);

    const balanceBefore = await qsd.balanceOf(await signer.getAddress());
    const ethBalanceBefore = await ethers.provider.getBalance(await signer.getAddress());
    const tx = await qsd.connect(signer).buyTokensWithEth({value: amountIn});
    const balanceAfter = await qsd.balanceOf(await signer.getAddress());
    const ethBalanceAfter = await ethers.provider.getBalance(await signer.getAddress());

    expect(balanceAfter - balanceBefore).to.equal(amountOut);
    expect(ethBalanceBefore - ethBalanceAfter).to.be.lt(amountIn + tx.gasPrice * tx.gasLimit);
  });
});