import { ethers, network } from "hardhat";
import { AQTIS_ADDRESS, AQTIS_POOL_ADDRESS } from "./utils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const USDC_USD_FEED = "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6";

describe("TokenPriceCalculator", () => {
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
    const priceOracle = await (await ethers.getContractFactory("TokenPriceCalculator")).deploy(
      AQTIS_POOL_ADDRESS,
      ETH_USD_FEED,
      USDC_USD_FEED,
      AQTIS_ADDRESS
    );

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

    await priceOracle.setStalePeriod(ETH_USD_FEED, 60 * 60 * 24 * 3);
    await priceOracle.setStalePeriod(USDC_USD_FEED, 60 * 60 * 24 * 3);
    return {priceOracle, weth, pool, router};
  }

  it("should deploy", async () => {
    const {priceOracle} = await loadFixture(deployFixture);
    expect(await priceOracle.getAddress()).to.not.be.undefined;
  });

  it("should get the correct aqtis price in usd", async () => {
    const {priceOracle} = await loadFixture(deployFixture);
    const price = await priceOracle.getAqtisPriceInUSD();
    expect(price).to.be.equal(ethers.parseUnits("0.01591555658408123", 18));
  });
});