import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  initializePool,
  NONFUNGIBLE_POSITION_MANAGER,
  RICH_ADDRESS,
  sqrt,
  UNISWAP_FACTORY,
  USDC_ADDRESS,
  WETH_ADDRESS
} from "./utils";


describe("LSTSwap", () => {
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
    const lstSwap = await (await ethers.getContractFactory("MockLSTSwap"))
      .deploy(UNISWAP_FACTORY, USDC_ADDRESS, WETH_ADDRESS);

    const tokenPriceCalculator = await (
      await ethers.getContractFactory("MockTokenPriceCalculator")
    ).deploy();

    const qsd = await (await ethers.getContractFactory("Qsd"))
      .deploy(USDC_ADDRESS);
    const qrt = await (await ethers.getContractFactory("Qrt"))
      .deploy(USDC_ADDRESS);
    const qeth = await (await ethers.getContractFactory("Qeth"))
      .deploy();


    // just a temp workaround to mint some qsd
    const signerAddress = await ethers.getSigners().then(signer => signer[0].getAddress());
    await qsd.setRewardsAddress(signerAddress);
    await qrt.setRewardsAddress(signerAddress);
    await qeth.setRewardsAddress(signerAddress);

    const mintAmountUsdc = ethers.parseUnits("1000000", 6); // 1_000_000
    const mintAmountEth = ethers.parseEther("1000"); // 1_000
    // mint some qsd
    await qsd.mint(mintAmountUsdc);
    await qsd.transfer(RICH_ADDRESS, mintAmountUsdc);

    // mint some qrt
    await qrt.mint(mintAmountUsdc);
    await qrt.transfer(RICH_ADDRESS, mintAmountUsdc);

    // mint some qEth
    await qeth.mint(mintAmountEth);
    await qeth.transfer(RICH_ADDRESS, mintAmountEth);

    // wrap some WETH
    const weth = await ethers.getContractAt("IWETH9", WETH_ADDRESS);
    await weth.connect(
      await ethers.getImpersonatedSigner(RICH_ADDRESS)
    ).deposit({value: 4n * mintAmountEth});

    const positionManager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER);
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    // create pool
    const {pool: qsdPool} = await initializePool(
      positionManager,
      qsd,
      usdc,
      sqrt(1n) * 2n ** 96n,
      mintAmountUsdc
    );

    await lstSwap.setUSDCPair(qsd.getAddress(), qsdPool.getAddress());

    const {pool: qrtPool} = await initializePool(
      positionManager,
      qrt,
      weth,
      // at $3k eth price it's 300 qrt = 1 weth ~ 10 usd / qrt
      sqrt((10n ** 12n) * (2n ** 192n) / 300n),
      mintAmountUsdc
    );

    await lstSwap.setWETHPair(qrt.getAddress(), qrtPool.getAddress());

    const {pool: qEthPool} = await initializePool(
      positionManager,
      qeth,
      weth,
      sqrt(1n) * 2n ** 96n,
      mintAmountEth
    );

    await lstSwap.setWETHPair(qeth.getAddress(), qEthPool.getAddress());


    // set default rewards address
    await qsd.setRewardsAddress(lstSwap.getAddress());
    await qrt.setRewardsAddress(lstSwap.getAddress());
    await qeth.setRewardsAddress(lstSwap.getAddress());
    return {
      lstSwap,
      tokenPriceCalculator,
      qsd,
      qeth,
      qrt,
      qsdPool,
      qrtPool,
      qEthPool,
      mintAmount: mintAmountUsdc,
      mintAmountEth,
      usdc,
      weth
    };
  }

  it("should deploy", async () => {
    const {lstSwap, qsdPool: pool, qsd} = await loadFixture(deployFixture);
    const qsdLiquidity = await qsd.balanceOf(pool.getAddress());
    const [sqrtPriceX96] = await pool.slot0();

    expect(qsdLiquidity).to.be.gt(0);
    expect(await lstSwap.getAddress()).to.be.not.undefined;
    expect(await lstSwap.usdcPairs(qsd.getAddress())).to.equal(await pool.getAddress());
    expect(sqrtPriceX96).to.be.closeTo((2n ** 96n), (2n ** 96n) / 100n); // 1% leeway
    expect(await qsd.rewardsAddress()).to.be.equal(await lstSwap.getAddress());
  });

  it("should swap qsd", async () => {
    const {lstSwap, qsd, mintAmount, usdc} = await loadFixture(deployFixture);
    const amountOut = ethers.parseUnits("100", 6);

    const qsdSupplyBefore = await qsd.totalSupply();

    const balanceBefore = await usdc.balanceOf(lstSwap.getAddress());
    await lstSwap.mintForExactOutUSDC(qsd.getAddress(), amountOut);
    const balanceAfter = await usdc.balanceOf(lstSwap.getAddress());

    const qsdSupplyAfter = await qsd.totalSupply();

    expect(balanceAfter - balanceBefore).to.be.equal(amountOut);

    // we give some leeway for the price impact, but the mint shouldn't be off by more than 1%
    expect(qsdSupplyAfter - qsdSupplyBefore).to.be.lt(ethers.parseUnits("101", 6));
  });

  it("should swap qeth", async () => {
    const {lstSwap, qeth, mintAmountEth, weth} = await loadFixture(deployFixture);
    const amountOut = ethers.parseEther("0.1");

    const qethSupplyBefore = await qeth.totalSupply();

    const balanceBefore = await weth.balanceOf(lstSwap.getAddress());
    await lstSwap.mintForExactOutETH(qeth.getAddress(), amountOut);
    const balanceAfter = await weth.balanceOf(lstSwap.getAddress());

    const qethSupplyAfter = await qeth.totalSupply();

    expect(balanceAfter - balanceBefore).to.be.equal(amountOut);

    // we give some leeway for the price impact, but the mint shouldn't be off by more than 1%
    expect(qethSupplyAfter - qethSupplyBefore).to.be.lt(ethers.parseEther("0.1004"));
  });

  it("should swap qrt", async () => {
    const {lstSwap, qrt, mintAmount, weth} = await loadFixture(deployFixture);
    const amountOut = ethers.parseEther("0.01");

    const qrtSupplyBefore = await qrt.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(lstSwap.getAddress());
    await lstSwap.mintForExactOutETH(qrt.getAddress(), amountOut);
    const wethBalanceAfter = await weth.balanceOf(lstSwap.getAddress());
    const qrtSupplyAfter = await qrt.totalSupply();
    expect(wethBalanceAfter - wethBalanceBefore).to.be.equal(amountOut);

    // we give some leeway for the price impact, but the mint shouldn't be off by more than 1%
    expect(qrtSupplyAfter - qrtSupplyBefore).to.be.lt(ethers.parseEther("0.1004"));
  });

  it("should fail when mint amount is too high", async () => {
    const {lstSwap, qsd} = await loadFixture(deployFixture);
    const amountOut = ethers.parseUnits("100000", 6);
    const qsdSupplyBefore = await qsd.totalSupply();

    // price should be around ~1 so this should definitely fail
    await expect(
      lstSwap.mintForExactOutUSDC(qsd.getAddress(), amountOut)
    ).to.be.revertedWith("LSTSwap: Exceeded max mint");

    const qsdSupplyAfter = await qsd.totalSupply();
    expect(qsdSupplyAfter - qsdSupplyBefore).to.be.equal(0);
  });

  it("should swap with exact in qrt", async () => {
    const {lstSwap, qrt, weth} = await loadFixture(deployFixture);
    const amountIn = ethers.parseUnits("100", 6);
    const wethBalanceBefore = await weth.balanceOf(lstSwap.getAddress());
    await lstSwap.mintWithExactInETH(qrt.getAddress(), amountIn);
    const wethBalanceAfter = await weth.balanceOf(lstSwap.getAddress());
    expect(wethBalanceAfter - wethBalanceBefore).to.be.gt(ethers.parseEther("0.09"));
  });


  it("should return the correct average price", async () => {
    const {lstSwap, qsd} = await loadFixture(deployFixture);
    const priceBefore = await lstSwap.calculateMinOutUSDC(qsd.getAddress(), 10n ** 6n);

    expect(priceBefore).to.be.closeTo(10n ** 6n * (97n * 2n ** 64n) / (100n * 2n ** 64n), 10n ** 6n / 1000n); // 0.1% leeway
  });

  it("should fail on low output amount", async () => {
    const {lstSwap, qsd, qsdPool} = await loadFixture(deployFixture);
    expect(
      lstSwap.exactInputInternal(
        qsdPool.getAddress(),
        qsd.getAddress(),
        USDC_ADDRESS,
        ethers.parseUnits("1", 6),
        ethers.parseUnits("100", 6)
      )
    ).to.be.revertedWith("LSTSwap: Insufficient output amount");
  });

  it("should fail on high input amount", async () => {
    const {lstSwap, qsd, qsdPool} = await loadFixture(deployFixture);
    expect(
      lstSwap.exactOutputInternal(
        qsdPool.getAddress(),
        qsd.getAddress(),
        USDC_ADDRESS,
        ethers.parseUnits("1", 6),
        ethers.parseUnits("100", 6)
      )
    ).to.be.revertedWith("LSTSwap: Exceeded max mint");
  });
});

