import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments} = hre;

  const QETH = await deployments.get("Qeth");
  const QRT = await deployments.get("Qrt");
  const QSD = await deployments.get("Qsd");
  const ClaimVault = await deployments.get("ClaimVault");

  if (!QETH || !QRT || !QSD || !ClaimVault) throw new Error("Deployment not found");
  console.log("Initializing LST contracts");
  console.log("\tRewardsAddress: ", ClaimVault.address);
  for (const deployment of [QETH, QRT, QSD]) {
    console.log("\tSetting rewards on: ", deployment.address);
    const contract = await hre.ethers.getContractAt("AbstractLST", deployment.address);
    const tx = await contract.setRewardsAddress(ClaimVault.address);
    const rx = await tx.wait();
    console.log("\t\ttx mined in block: ", rx?.blockNumber);

    console.log("\tSetting token price calculator on: ", deployment.address);
    const tokenPriceCalculator = await deployments.get("TokenPriceCalculator");
    const tx2 = await contract.setTokenPriceCalculator(tokenPriceCalculator.address);
    console.log("\t\ttx submitted with hash: ", tx2.hash);
    let rx2 = await tx2.wait();
    console.log("\t\ttx mined in block: ", rx2?.blockNumber);
  }
}

func.tags = ["Initialize"];
export default func