import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const claimVault = await hre.deployments.get("ClaimVault");
  if (!claimVault || !claimVault.address) {
    throw new Error("ClaimVault not deployed");
  }

  await hre.deployments.deploy("BatchClaim", {
    from: deployer,
    args: [claimVault.address],
    log: true,
    autoMine: true,
  })
}

func.tags = ["BatchClaim"];
export default func
