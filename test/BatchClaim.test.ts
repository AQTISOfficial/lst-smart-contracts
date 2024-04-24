import { ethers, network } from "hardhat";
import {
  AQTIS_ADDRESS,
  AQTIS_POOL_ADDRESS, initializePool,
  NONFUNGIBLE_POSITION_MANAGER,
  RICH_ADDRESS, sqrt,
  UNISWAP_FACTORY,
  USDC_ADDRESS,
  WETH_ADDRESS
} from "./utils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const USDC_USD_FEED = "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6";
const AQTIS_HOLDING_ADDRESS = "0x1eD086f9bdc70788EcdA67899AB8C922Ff7F305d";

describe("BatchClaim", () => {
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

    // deploy some lsts
    const qeth = await (await ethers.getContractFactory("Qeth")).deploy();
    const qsd = await (await ethers.getContractFactory("Qsd")).deploy(USDC_ADDRESS);

    await qeth.setBuyActive(true);
    await qeth.setRewardsAddress(claimVault.getAddress());
    await qeth.setDistributionAddress(distrubutor);
    await qeth.setTokenPriceCalculator(tokenPriceCalculator.getAddress());

    const signer = await ethers.getImpersonatedSigner(RICH_ADDRESS);

    // buy some qeth
    await qeth.connect(signer).buyTokensWithEth({value: ethers.parseEther("2000")});

    // create lp pools
    const positionManager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER);
    const weth = await ethers.getContractAt("IWETH9", WETH_ADDRESS);
    await weth.connect(signer).deposit({value: ethers.parseEther("1000")});

    // create pool
    const {pool: qethPool} = await initializePool(
      positionManager,
      qeth,
      weth,
      sqrt(1n) * 2n ** 96n,
      ethers.parseEther("1000")
    );

    await claimVault.addLST(qeth.getAddress());
    await claimVault.setWethPair(qeth.getAddress(), qethPool.getAddress());
    await claimVault.addLST(qsd.getAddress());

    // fund a user
    const user = await ethers.getSigners().then(signer => signer[1]);
    await weth.connect(signer).transfer(user.getAddress(), ethers.parseEther("100"));

    // deploy batch claim
    const batchClaim = await (await ethers.getContractFactory("BatchClaim"))
      .deploy(claimVault.getAddress());

    return {claimVault, qeth, user, qsd, signer, batchClaim};
  }

  it("should deploy", async () => {
    const {batchClaim} = await loadFixture(deployFixture);
    expect(await batchClaim.getAddress()).to.not.be.undefined;
  });

  it("should allow users to enable auto claim", async () => {
    const {user, batchClaim, qeth, qsd} = await loadFixture(deployFixture);
    await batchClaim.connect(user).setAutoClaim(qeth.getAddress(), true);
    expect(await batchClaim.isAutoClaimEnabled(qeth.getAddress(), user.getAddress())).to.be.true;

    expect(await batchClaim.isAutoClaimEnabled(qsd.getAddress(), user.getAddress())).to.be.false;
    expect(await batchClaim.getAutoClaimUsers()).to.include(await user.getAddress());
  });

  it("should allow users to disable auto claim", async () => {
    const {user, batchClaim, qeth, qsd} = await loadFixture(deployFixture);
    await batchClaim.connect(user).setAutoClaim(qeth.getAddress(), true);
    await batchClaim.connect(user).setAutoClaim(qsd.getAddress(), true);
    expect(await batchClaim.isAutoClaimEnabled(qeth.getAddress(), user.getAddress())).to.be.true;
    expect(await batchClaim.isAutoClaimEnabled(qsd.getAddress(), user.getAddress())).to.be.true;
    expect(await batchClaim.getAutoClaimUsers()).to.include(await user.getAddress());

    await batchClaim.connect(user).setAutoClaim(qeth.getAddress(), false);
    expect(await batchClaim.isAutoClaimEnabled(qeth.getAddress(), user.getAddress())).to.be.false;
    expect(await batchClaim.isAutoClaimEnabled(qsd.getAddress(), user.getAddress())).to.be.true;
    expect(await batchClaim.getAutoClaimUsers()).to.include(await user.getAddress());

    await batchClaim.connect(user).setAutoClaim(qsd.getAddress(), false);
    expect(await batchClaim.isAutoClaimEnabled(qeth.getAddress(), user.getAddress())).to.be.false;
    expect(await batchClaim.isAutoClaimEnabled(qsd.getAddress(), user.getAddress())).to.be.false;
    expect(await batchClaim.getAutoClaimUsers()).to.not.include(await user.getAddress());
  });

  it("should claim rewards", async () => {
    const {user, batchClaim, qeth, signer, claimVault} = await loadFixture(deployFixture);
    await batchClaim.connect(user).setAutoClaim(qeth.getAddress(), true);

    await qeth.connect(user).buyTokensWithEth({value: ethers.parseEther("1")});
    expect(await qeth.balanceOf(user.getAddress())).to.be.gt(0n);

    await time.increase(60 * 60 * 24 * 7);
    expect((await claimVault.getRewardsFor(qeth.getAddress(), user.getAddress())).ethRewards).to.be.gt(0n, "No rewards to claim");

    const ethBalanceBefore = await ethers.provider.getBalance(user.getAddress());
    expect(await batchClaim.batchClaim()).to.not.emit(batchClaim, "ClaimFailed");
    const ethBalanceAfter = await ethers.provider.getBalance(user.getAddress());
    expect(ethBalanceAfter - ethBalanceBefore).to.be.gt(0n);
  });

  it("should claim rewards for user", async () => {
    const {user, batchClaim, qeth, signer, claimVault} = await loadFixture(deployFixture);
    await batchClaim.connect(user).setAutoClaim(qeth.getAddress(), true);

    await qeth.connect(user).buyTokensWithEth({value: ethers.parseEther("1")});
    expect(await qeth.balanceOf(user.getAddress())).to.be.gt(0n);

    await time.increase(60 * 60 * 24 * 7);
    expect((await claimVault.getRewardsFor(qeth.getAddress(), user.getAddress())).ethRewards).to.be.gt(0n, "No rewards to claim");

    const ethBalanceBefore = await ethers.provider.getBalance(user.getAddress());
    expect(await batchClaim.multiClaim([await user.getAddress()])).to.not.emit(batchClaim, "ClaimFailed");
    const ethBalanceAfter = await ethers.provider.getBalance(user.getAddress());
    expect(ethBalanceAfter - ethBalanceBefore).to.be.gt(0n);
  });

  it("should not claim rewards", async () => {
    const {user, batchClaim, qeth, signer, claimVault} = await loadFixture(deployFixture);
    await batchClaim.connect(user).setAutoClaim(qeth.getAddress(), false);

    await qeth.connect(user).buyTokensWithEth({value: ethers.parseEther("1")});
    expect(await qeth.balanceOf(user.getAddress())).to.be.gt(0n);

    await time.increase(60 * 60 * 24 * 7);
    expect((await claimVault.getRewardsFor(qeth.getAddress(), user.getAddress())).ethRewards).to.be.gt(0n, "No rewards to claim");

    let ethBalanceBefore = await ethers.provider.getBalance(user.getAddress());
    expect(await batchClaim.batchClaim()).to.not.emit(batchClaim, "ClaimFailed");
    let ethBalanceAfter = await ethers.provider.getBalance(user.getAddress());
    expect(ethBalanceAfter - ethBalanceBefore).to.be.equal(0n);

    ethBalanceBefore = await ethers.provider.getBalance(user.getAddress());
    expect(await batchClaim.multiClaim([await user.getAddress()])).to.not.emit(batchClaim, "ClaimFailed");
    ethBalanceAfter = await ethers.provider.getBalance(user.getAddress());
    expect(ethBalanceAfter - ethBalanceBefore).to.be.equal(0n);

    ethBalanceBefore = await ethers.provider.getBalance(user.getAddress());
    expect(await batchClaim.multiClaimLST(qeth.getAddress(), [await user.getAddress()])).to.not.emit(batchClaim, "ClaimFailed");
    ethBalanceAfter = await ethers.provider.getBalance(user.getAddress());
    expect(ethBalanceAfter - ethBalanceBefore).to.be.equal(0n);
  });

  it("should claim rewards for a specific LST", async () => {
    const {user, batchClaim, qeth, signer, claimVault} = await loadFixture(deployFixture);
    await batchClaim.connect(user).setAutoClaim(qeth.getAddress(), false);

    await qeth.connect(user).buyTokensWithEth({value: ethers.parseEther("1")});
    expect(await qeth.balanceOf(user.getAddress())).to.be.gt(0n);

    await time.increase(60 * 60 * 24 * 7);
    expect((await claimVault.getRewardsFor(qeth.getAddress(), user.getAddress())).ethRewards).to.be.gt(0n, "No rewards to claim");

    let ethBalanceBefore = await ethers.provider.getBalance(user.getAddress());
    expect(await batchClaim.multiClaimLST(qeth.getAddress(), [await user.getAddress()])).to.not.emit(batchClaim, "ClaimFailed");
    let ethBalanceAfter = await ethers.provider.getBalance(user.getAddress());
    expect(ethBalanceAfter - ethBalanceBefore).to.be.equal(0n);
  });
});