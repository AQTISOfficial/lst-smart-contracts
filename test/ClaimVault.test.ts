import { ethers, network } from "hardhat";
import {
  AQTIS_ADDRESS,
  AQTIS_POOL_ADDRESS,
  initializePool,
  NONFUNGIBLE_POSITION_MANAGER,
  RICH_ADDRESS,
  sqrt,
  UNISWAP_FACTORY,
  USDC_ADDRESS,
  WETH_ADDRESS
} from "./utils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const USDC_USD_FEED = "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6";
const AQTIS_HOLDING_ADDRESS = "0x1eD086f9bdc70788EcdA67899AB8C922Ff7F305d";

describe("ClaimVault", () => {
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

    await tokenPriceCalculator.setStalePeriod(ETH_USD_FEED, 60 * 60 * 24 * 100);
    await tokenPriceCalculator.setStalePeriod(USDC_USD_FEED, 60 * 60 * 24 * 100);

    const claimVault = await (await ethers.getContractFactory("ClaimVault"))
      .deploy(
        UNISWAP_FACTORY,
        USDC_ADDRESS,
        WETH_ADDRESS,
        AQTIS_ADDRESS
      );
    const distrubutor = await ethers.getSigners().then(signer => signer[0].getAddress());

    // fund with aqtis tokens
    const aqtis = await ethers.getContractAt("IERC20", AQTIS_ADDRESS);
    const aqtisHolder = await ethers.getImpersonatedSigner(AQTIS_HOLDING_ADDRESS);
    await aqtis.connect(aqtisHolder).transfer(claimVault.getAddress(), ethers.parseUnits("100000", 18));

    const qsd = await (await ethers.getContractFactory("Qsd")).deploy(USDC_ADDRESS);
    const qeth = await (await ethers.getContractFactory("Qeth")).deploy();

    await qsd.setBuyActive(true);
    await qsd.setRewardsAddress(claimVault.getAddress());
    await qsd.setDistributionAddress(distrubutor);
    await qsd.setTokenPriceCalculator(tokenPriceCalculator.getAddress());

    await qeth.setBuyActive(true);
    await qeth.setRewardsAddress(claimVault.getAddress());
    await qeth.setDistributionAddress(distrubutor);
    await qeth.setTokenPriceCalculator(tokenPriceCalculator.getAddress());

    const signer = await ethers.getImpersonatedSigner(RICH_ADDRESS);

    // buy some qsd
    await (await ethers.getContractAt("IERC20", USDC_ADDRESS)).connect(signer).approve(qsd.getAddress(), ethers.MaxUint256);
    await qsd.connect(signer).buyTokens(ethers.parseUnits("600000", 6));

    // buy some qeth
    await qeth.connect(signer).buyTokensWithEth({value: ethers.parseEther("2000")});

    // create lp pools
    const positionManager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER);
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    const weth = await ethers.getContractAt("IWETH9", WETH_ADDRESS);
    await weth.connect(signer).deposit({value: ethers.parseEther("1000")});

    // create pool
    const {pool: qsdPool} = await initializePool(
      positionManager,
      qsd,
      usdc,
      sqrt(1n) * 2n ** 96n,
      ethers.parseUnits("500000", 6)
    );

    const {pool: qethPool} = await initializePool(
      positionManager,
      qeth,
      weth,
      sqrt(1n) * 2n ** 96n,
      ethers.parseEther("1000")
    );

    await claimVault.addLST(qsd.getAddress());
    await claimVault.addLST(qeth.getAddress());

    await claimVault.setUsdcPair(qsd.getAddress(), qsdPool.getAddress());
    await claimVault.setWethPair(qeth.getAddress(), qethPool.getAddress());

    // fund a user
    const user = await ethers.getSigners().then(signer => signer[1]);
    await usdc.connect(signer).transfer(user.getAddress(), ethers.parseUnits("100000", 6));
    await weth.connect(signer).transfer(user.getAddress(), ethers.parseEther("100"));

    return {claimVault, qsd, qeth, user, signer};
  }

  it("should deploy", async () => {
    const {claimVault} = await loadFixture(deployFixture);
    expect(await claimVault.getAddress()).to.not.be.undefined;
  });

  it("should allow rewards claim preview", async () => {
    const {claimVault, qsd, qeth, user, signer} = await loadFixture(deployFixture);
    await qsd.connect(signer).transfer(user.getAddress(), ethers.parseUnits("100", 6))

    // wait a week
    await time.increase(60 * 60 * 24 * 7);

    const rewards = await claimVault.getRewardsFor(qsd.getAddress(), user.getAddress());
    expect(rewards.usdcRewards).to.be.gt(0n);
    expect(rewards.ethRewards).to.equal(0n);
    expect(rewards.aqtisRewards).to.be.gt(0n);
  });

  it("should allow rewards claim", async () => {
    const {claimVault, qsd, user, signer} = await loadFixture(deployFixture);
    await qsd.connect(signer).transfer(user.getAddress(), ethers.parseUnits("100", 6))

    // wait a week
    await time.increase(60 * 60 * 24 * 7);

    const usdcBalanceBefore = await balanceOf(USDC_ADDRESS, user.getAddress());
    const rewards = await claimVault.getRewardsFor(qsd.getAddress(), user.getAddress());
    await claimVault.connect(user).claimRewards(qsd.getAddress());
    const usdcBalanceAfter = await balanceOf(USDC_ADDRESS, user.getAddress());

    expect(usdcBalanceAfter - usdcBalanceBefore).to.be.gt(0n);
    expect(usdcBalanceAfter - usdcBalanceBefore).to.equal(rewards.usdcRewards);
  });

  it("should allow rewards to be claimed on behalf of user", async () => {
    const {claimVault, qsd, user, signer} = await loadFixture(deployFixture);
    await qsd.connect(signer).transfer(user.getAddress(), ethers.parseUnits("100", 6));
    const balanceBefore = await balanceOf(USDC_ADDRESS, user.getAddress());

    // wait a week
    await time.increase(60 * 60 * 24 * 7);

    const rewards = await claimVault.getRewardsFor(qsd.getAddress(), user.getAddress());
    await claimVault.connect(signer).claimRewardsFor(qsd.getAddress(), user.getAddress());
    const balanceAfter = await balanceOf(USDC_ADDRESS, user.getAddress());

    expect(balanceAfter - balanceBefore).to.be.gt(0n);
    expect(balanceAfter - balanceBefore).to.equal(rewards.usdcRewards);
  });

  it("should turn on autocompounding", async () => {
    const {claimVault, qsd, user} = await loadFixture(deployFixture);
    await claimVault.connect(user).setAutoCompound(qsd.getAddress(), true);
    expect(await claimVault.isAutoCompounding(qsd.getAddress(), user.getAddress())).to.be.true;
  });

  it("should autocompound rewards", async () => {
    const {claimVault, qeth, user, signer} = await loadFixture(deployFixture);
    await qeth.connect(signer).transfer(user.getAddress(), ethers.parseUnits("1", 18));

    // turn on autocompound
    await claimVault.connect(user).setAutoCompound(qeth.getAddress(), true);

    // wait a week
    await time.increase(60 * 60 * 24 * 7);

    const ethBalanceBefore = await ethers.provider.getBalance(user.getAddress());
    const lstBalanceBefore = await balanceOf(qeth.getAddress(), user.getAddress());
    const aqtisBalanceBefore = await balanceOf(AQTIS_ADDRESS, user.getAddress());

    const rewards = await claimVault.getRewardsFor(qeth.getAddress(), user.getAddress());
    expect(rewards.ethRewards).to.be.gt(0n);

    const tx = await claimVault.connect(user).claimRewards(qeth.getAddress());

    const ethBalanceAfter = await ethers.provider.getBalance(user.getAddress());
    const lstBalanceAfter = await balanceOf(qeth.getAddress(), user.getAddress());
    const aqtisBalanceAfter = await balanceOf(AQTIS_ADDRESS, user.getAddress());

    const expectedLSTClaim = await claimVault.estimateValueWETH(qeth.getAddress(), rewards.ethRewards);

    expect(ethBalanceBefore - ethBalanceAfter).to.be.lt(tx.gasLimit * tx.gasPrice);
    expect(lstBalanceAfter - lstBalanceBefore).to.be.closeTo(expectedLSTClaim, expectedLSTClaim / 10000n);
    expect(aqtisBalanceAfter - aqtisBalanceBefore).to.be.closeTo(rewards.aqtisRewards, rewards.aqtisRewards / 10000n);

  });
});

async function balanceOf(erc20: string | Promise<string>, user: string | Promise<string>): Promise<bigint> {
  let token = typeof erc20 === "string" ? erc20 : await erc20;
  return (await ethers.getContractAt("IERC20", token)).balanceOf(user);
}