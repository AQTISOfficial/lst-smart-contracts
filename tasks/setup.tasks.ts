import {task} from "hardhat/config";
import {getLSTAddress} from "./utils";
import {ContractTransactionResponse} from "ethers";
import {boolean} from "hardhat/internal/core/params/argumentTypes";

task("set:distributor", "Set the distributor address for an LST")
  .addParam<"QSD" | "QRT" | "QETH">("lst", "Address of the LST", "QSD")
  .addParam<string>("distributor", "Address of the distributor")
  .setAction(async (taskArgs: {
    lst: "QSD" | "QRT" | "QETH",
    distributor: string,
  }, {ethers, deployments}) => {
    let lstAddress = await getLSTAddress(deployments, taskArgs.lst);
    let lst = await ethers.getContractAt("AbstractLST", lstAddress);
    let tx = await lst.setDistributionAddress(taskArgs.distributor);

    console.log("submitted tx with hash: ", tx.hash);
    console.log("waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("confirmed tx in block: ", receipt?.blockNumber);
  });

task("set:calculator", "Set the token price calculator for an LST")
  .addParam<"QSD" | "QRT" | "QETH">("lst", "Address of the LST", "QSD")
  .addParam<string>("calculator", "Address of the calculator")
  .setAction(async (taskArgs: {
    lst: "QSD" | "QRT" | "QETH",
    calculator: string,
  }, {ethers, deployments}) => {
    let lstAddress = await getLSTAddress(deployments, taskArgs.lst);
    let lst = await ethers.getContractAt("AbstractLSTLST", lstAddress);
    let tx = await lst.setTokenPriceCalculator(taskArgs.calculator);

    console.log("submitted tx with hash: ", tx.hash);
    console.log("waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("confirmed tx in block: ", receipt.blockNumber);
  });

task("set:rewards", "Set the rewards address for an LST")
  .addParam<"QSD" | "QRT" | "QETH">("lst", "Address of the LST", "QSD")
  .addParam<string>("rewards", "Address of the rewards")
  .setAction(async (taskArgs: {
    lst: "QSD" | "QRT" | "QETH",
    rewards: string,
  }, {ethers, deployments}) => {
    let lstAddress = await getLSTAddress(deployments, taskArgs.lst);
    let lst = await ethers.getContractAt("AbstractLSTLST", lstAddress);
    let tx = await lst.setRewardsAddress(taskArgs.rewards);

    console.log("submitted tx with hash: ", tx.hash);
    console.log("waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("confirmed tx in block: ", receipt.blockNumber);
  });

task("set:buy-active", "Set the buy active status for an LST")
  .addParam<"QSD" | "QRT" | "QETH">("lst", "Address of the LST", "QSD")
  .addParam<boolean>("active", "whether the buy active is turned on", true, boolean, true)
  .setAction(async (taskArgs: {
    lst: "QSD" | "QRT" | "QETH",
    active: boolean,
  }, {ethers, deployments}) => {
    let lstAddress = await getLSTAddress(deployments, taskArgs.lst);
    let lst = await ethers.getContractAt("AbstractLST", lstAddress);
    let tx = await lst.setBuyActive(taskArgs.active);

    console.log("submitted tx with hash: ", tx.hash);
    console.log("waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("confirmed tx in block: ", receipt?.blockNumber);
  });

task("set:lstpool", "Set the LST pool address for an LST")
  .addParam<"QETH" | "QSD" | "QRT">("lst", "LST symbol enum", "QSD")
  .addParam<"USDC" | "WETH">("tokenB", "Paired token with the LST", "USDC")
  .addParam<string>("pool", "Address of the pool", undefined, undefined, false)
  .setAction(async (taskArgs: {
    lst: "QSD" | "QRT" | "QETH",
    tokenB: "USDC" | "WETH",
    pool: string,
  }, {ethers, deployments}) => {
    console.log(taskArgs);
    const lstAddress = await getLSTAddress(deployments, taskArgs.lst);
    const claimVault = await ethers.getContractAt("ClaimVault", (await deployments.get("ClaimVault")).address);


    let tx: ContractTransactionResponse;
    if (taskArgs.tokenB === "USDC") {
      tx = await claimVault.setUsdcPair(lstAddress, taskArgs.pool);
    } else {
      tx = await claimVault.setWethPair(lstAddress, taskArgs.pool);
    }

    console.log("submitted tx with hash: ", tx.hash);
    console.log("waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("confirmed tx in block: ", receipt?.blockNumber);
  });

task("set:whitelist-active")
  .addParam<"QETH" | "QSD" | "QRT">("lst", "LST symbol enum", "QSD")
  .addParam<boolean>("active", "whether the whitelist is turned on", true, boolean, true)
  .setAction(async (taskArgs: {
      lst: "QSD" | "QRT" | "QETH",
      active: boolean,
    }, {ethers, deployments}) => {
      if (taskArgs.active) {
        console.log(`Activating whitelist on ${taskArgs.lst}`);
      } else {
        console.log(`Deactivating whitelist on ${taskArgs.lst}`)
      }
      let lstAddress = await getLSTAddress(deployments, taskArgs.lst);
      let lst = await ethers.getContractAt("AbstractLST", lstAddress);
      let tx = await lst.setWhitelistActive(taskArgs.active);

      console.log("submitted tx with hash: ", tx.hash);
      console.log("waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("confirmed tx in block: ", receipt?.blockNumber);

    }
  );