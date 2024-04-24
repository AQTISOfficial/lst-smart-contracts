import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const qeth = await hre.deployments.get("Qeth");
  const qsd = await hre.deployments.get("Qsd");
  const qrt = await hre.deployments.get("Qrt");

  if (!qeth || !qeth.address || !qsd || !qsd.address || !qrt || !qrt.address) {
    throw new Error("Qeth, Qsd, or Qrt not deployed");
  }

  await hre.deployments.deploy("Compose", {
    from: deployer,
    args: [qeth.address, qsd.address, qrt.address],
    log: true,
    autoMine: true,
  })
}

func.tags = ["Compose"];
export default func
