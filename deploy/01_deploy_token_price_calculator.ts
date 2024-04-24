import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import {
  AQTIS_ADDRESSES,
  AQTIS_POOL_ADDRESSES,
  CHAINLINK_ETH_FEED_ADDRESSES,
  CHAINLINK_USDC_FEED_ADDRESSES
} from "../constants";


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts()
  const chainId = Number(await hre.ethers.provider.getNetwork().then(network => network.chainId));
  const aqtisWETHPair = AQTIS_POOL_ADDRESSES[chainId];
  const ethPriceFeed = CHAINLINK_ETH_FEED_ADDRESSES[chainId];
  const usdPriceFeed = CHAINLINK_USDC_FEED_ADDRESSES[chainId];
  const aqtisTokenAddress = AQTIS_ADDRESSES[chainId];

  if(!aqtisWETHPair || !ethPriceFeed || !usdPriceFeed || !aqtisTokenAddress) {
    throw new Error("Missing addresses for aqtisWETHPair, ethPriceFeed, usdPriceFeed, or aqtisTokenAddress");
  }

  await hre.deployments.deploy("TokenPriceCalculator", {
    from: deployer,
    log: true,
    args: [aqtisWETHPair, ethPriceFeed, usdPriceFeed, aqtisTokenAddress]
  })
}
export default func
func.tags = ["TokenPriceCalculator"]
