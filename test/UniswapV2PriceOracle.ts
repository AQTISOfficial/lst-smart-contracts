import { network, ethers } from "hardhat";
import { AQTIS_ADDRESS, AQTIS_POOL_ADDRESS, RICH_ADDRESS, WETH_ADDRESS } from "./utils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";


describe("UniswapV2PriceOracle", () => {
  before(async () => {
    // setup the network
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.MAINNET_ALCHEMY_API_KEY}`,
          blockNumber: 19275880,
        }
      }],
    });
  });

  const deployFixture = async () => {
    const priceOracle = await (await ethers.getContractFactory("UniswapV2PriceOracle")).deploy(AQTIS_POOL_ADDRESS);
    const router = await (await ethers.getContractFactory("MockUniswapV2Router")).deploy();

    const pool = await ethers.getContractAt("IUniswapV2Pair", AQTIS_POOL_ADDRESS);
    const token0 = await pool.token0();
    const token1 = await pool.token1();
    const wethAddress = token0.toLowerCase() === AQTIS_ADDRESS.toLowerCase() ? token1 : token0;
    const weth = await ethers.getContractAt("IERC20", wethAddress);

    await time.increase(60 * 60 * 24 + 1);
    await priceOracle.update();
    // wait 24h + 1s
    await time.increase(60 * 60 * 24 + 1);
    await priceOracle.update();

    return {priceOracle, weth, pool, router};
  }

  it("should deploy", async () => {
    const {priceOracle} = await loadFixture(deployFixture);
    expect(await priceOracle.getAddress()).to.not.be.undefined;
  });

  it("should get weth price in aqtis", async () => {
    const {priceOracle, weth} = await loadFixture(deployFixture);

    const price = await priceOracle.getPrice(await weth.getAddress());
    expect(price).to.be.equal(181947887571604439302111n);
  });

  it("should get aqtis price in weth", async () => {
    const {priceOracle, weth} = await loadFixture(deployFixture);

    const price = await priceOracle.getPrice(AQTIS_ADDRESS);
    expect(price).to.be.eq(5496079197987n);
  });

  it("should return average value", async () => {
    const {priceOracle, router, pool, weth} = await loadFixture(deployFixture);
    const priceBefore = await priceOracle.getPrice(AQTIS_ADDRESS);

    // change the price
    const signer = await ethers.getImpersonatedSigner(RICH_ADDRESS);
    const weth9 = await ethers.getContractAt("IWETH9", await weth.getAddress());
    await weth9.connect(signer).deposit({value: ethers.parseEther("50")});
    await weth9.connect(signer).approve(router.getAddress(), ethers.parseEther("50"));

    await router.connect(signer).swapExactTokensForTokens(
      pool.getAddress(),
      weth.getAddress(),
      ethers.parseEther("50"),
      0,
    );

    // wait 24h + 1s
    await time.increase(60 * 60 * 24 + 1);
    await priceOracle.update();

    const priceAfter = await priceOracle.getPrice(AQTIS_ADDRESS);
    expect(priceAfter).to.be.not.equal(priceBefore);

    const [reserve0, reserve1] = await pool.getReserves();
    const currentPrice = AQTIS_ADDRESS.toLowerCase() === (await pool.token0()).toLowerCase() ?
      (reserve1 * 10n ** 18n) / reserve0 : (reserve0 * 10n ** 18n) / reserve1;

    // current price > price average > price before
    expect(currentPrice).to.be.gt(priceAfter);
    expect(priceAfter).to.be.gt(priceBefore);
  });
});