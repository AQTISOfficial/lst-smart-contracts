import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { AQTIS_ADDRESSES, UNISWAP_FACTORY_ADDRESSES, USDC_ADDRESSES, WETH_ADDRESSES } from "../constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const chainId = Number(await hre.ethers.provider.getNetwork().then(network => network.chainId));
  const factory = UNISWAP_FACTORY_ADDRESSES[chainId];
  const usdc = USDC_ADDRESSES[chainId];
  const weth = WETH_ADDRESSES[chainId];
  const aqtisAddress = AQTIS_ADDRESSES[chainId];

  if (!factory || !usdc || !weth || !aqtisAddress) {
    throw new Error("Missing addresses for factory, usdc, weth, or aqtisAddress");
  }

  await hre.deployments.deploy("ClaimVault", {
    from: deployer,
    args: [factory, usdc, weth, aqtisAddress],
    log: true,
    autoMine: true,
  })
}

func.tags = ["ClaimVault"];
export default func
