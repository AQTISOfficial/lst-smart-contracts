import { task } from "hardhat/config";

task("deploy:usd", "Deploy mock usd token")
  .addParam("supply", "Initial supply of the token", "1000000")
  .setAction(async (taskArgs, hre) => {
    const {deployer} = await hre.getNamedAccounts();
    const initialSupply = hre.ethers.parseUnits(taskArgs.supply, 6);
    await hre.deployments.deploy("MockUSD", {
      from: deployer,
      args: [initialSupply],
      log: true,
      autoMine: true,
    });
  });

task("deploy:aqtis", "Deploy mock Aqtis token")
  .setAction(async (taskArgs, hre) => {
    const {deployer} = await hre.getNamedAccounts();
    await hre.deployments.deploy("MockAQTIS", {
      from: deployer,
      log: true,
      autoMine: true,
    });
  });

