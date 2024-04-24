import { task } from "hardhat/config";

task("price:update")
  .setAction(async (args, {ethers, deployments}) => {
    const tokenPriceCalculator = await ethers.getContractAt(
      "TokenPriceCalculator",
      (await deployments.get("TokenPriceCalculator")
      ).address);
    const tx = await tokenPriceCalculator.update();
    console.log("Token price updated");
    console.log("\ttx submitted with hash: ", tx.hash);
    let rx = await tx.wait();
    console.log("\ttx mined in block: ", rx?.blockNumber);
  });
