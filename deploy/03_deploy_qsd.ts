import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { USDC_ADDRESSES } from "../constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const chainId = Number(await hre.ethers.provider.getNetwork().then(network => network.chainId));
  const usd = USDC_ADDRESSES[chainId];
  if (!usd) throw new Error("USDC address not found");

  await hre.deployments.deploy("Qsd", {
    from: deployer,
    args: [usd],
    log: true,
    autoMine: true,
  })
}

func.tags = ["Qsd"];
export default func
