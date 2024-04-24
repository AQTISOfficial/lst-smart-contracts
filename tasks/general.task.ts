import {task} from "hardhat/config";
import {WETH_ADDRESSES} from "../constants";
import {getLSTAddress} from "./utils";
import * as readline from "readline/promises";

task("list:lsts")
  .setAction(async (args, {ethers, deployments}) => {
    const QETH = await deployments.get("Qeth");
    const QRT = await deployments.get("Qrt");
    const QSD = await deployments.get("Qsd");

    if (!QETH || !QRT || !QSD) throw new Error("Deployment not found");

    const qeth = await ethers.getContractAt("Qeth", QETH.address);
    const qrt = await ethers.getContractAt("Qrt", QRT.address);
    const qsd = await ethers.getContractAt("Qsd", QSD.address);

    console.log("LST contracts:");

    console.log("\tQETH: ", QETH.address);
    console.log("\t\tdecimals: ", await qeth.decimals());
    console.log("\t\tcap: ", ethers.formatUnits(await qeth.cap(), 18));
    console.log("\t\ttotalSupply: ", ethers.formatUnits(await qeth.totalSupply(), 18));
    console.log("\t\trewards address: ", await qeth.rewardsAddress())
    console.log("\t\tdistributor: ", await qeth.distributionAddress())

    console.log("\tQRT: ", QRT.address);
    console.log("\t\tdecimals: ", await qrt.decimals());
    console.log("\t\tcap: ", ethers.formatUnits(await qrt.cap(), 6));
    console.log("\t\ttotalSupply: ", ethers.formatUnits(await qrt.totalSupply(), 6));
    console.log("\t\trewards address: ", await qeth.rewardsAddress());
    console.log("\t\tdistributor: ", await qeth.rewardsAddress());

    console.log("\tQSD: ", QSD.address);
    console.log("\t\tdecimals: ", await qsd.decimals());
    console.log("\t\tcap: ", ethers.formatUnits(await qsd.cap(), 6));
    console.log("\t\ttotalSupply: ", ethers.formatUnits(await qsd.totalSupply(), 6));
    console.log("\t\trewards address: ", await qsd.rewardsAddress());
    console.log("\t\tdistributor: ", await qsd.distributionAddress());

    console.log("");

    const chainId = Number(await ethers.provider.getNetwork().then(n => n.chainId));
    console.log("General contracts:")
    console.log("WETH:\n\t", WETH_ADDRESSES[chainId]);
    console.log("TokenPriceCalculator:\n\t", (await deployments.get("TokenPriceCalculator")).address);
    console.log("ClaimVault:\n\t", (await deployments.get("ClaimVault")).address);
  });

task("buy:lst")
  .addParam("amount", "Amount of LST to buy", "100")
  .addParam<"ETH" | "USDC">("token", "Token to use for buying", "ETH")
  .addParam<"QSD" | "QETH" | "QRT">("lst", "LST to buy", "QSD")
  .setAction(async (args: {
    amount: string;
    token: "ETH" | "USDC";
    lst: "QSD" | "QETH" | "QRT";
  }, {ethers, deployments}) => {
    const lst = await ethers.getContractAt("AbstractLST", await getLSTAddress(deployments, args.lst));
    const amount = ethers.parseUnits(args.amount, args.token === "ETH" ? 18 : 6);
    const signer = await (await ethers.getSigners())[0].getAddress();
    if (args.token === "ETH") {
      const tx = await lst.buyTokensWithEth({value: amount});
      console.log("LST bought with ETH");
      console.log("\ttx submitted with hash: ", tx.hash);
      let rx = await tx.wait();
      console.log("\ttx mined in block: ", rx?.blockNumber);
    } else {
      const usdc = await ethers.getContractAt("MockUSD", (await deployments.get("MockUSD")).address);
      const tx = await usdc.approve(lst.getAddress(), amount);
      console.log("Approved USDC spending");
      console.log("\ttx submitted with hash: ", tx.hash);
      let rx = await tx.wait();
      console.log("\ttx mined in block: ", rx?.blockNumber);
      const tx2 = await lst.buyTokens(amount);
      console.log("LST bought with USDC");
      console.log("\ttx submitted with hash: ", tx2.hash);
      let rx2 = await tx2.wait();
      console.log("\ttx mined in block: ", rx2?.blockNumber);
    }
  });

task("set:claim-vault-lst", "Add an LST to the claim vault")
  .addParam<"QETH" | "QRT" | "QSD">("lst", "LST to add to the claim vault")
  .setAction(async (args: { lst: "QETH" | "QRT" | "QSD" }, {ethers, deployments}) => {
    const claimVault = await ethers.getContractAt(
      "ClaimVault",
      (await deployments.get("ClaimVault")).address
    );
    const lstAddress = await getLSTAddress(deployments, args.lst);
    console.log(`Adding ${args.lst} (${lstAddress}) to claim vault at ${await claimVault.getAddress()}`);
    const tx = await claimVault.addLST(lstAddress);
    console.log("LST added to claim vault");
    console.log("\ttx submitted with hash: ", tx.hash);
    let rx = await tx.wait();
    console.log("\ttx mined in block: ", rx?.blockNumber);
  });

task("update:owner")
  .addParam<string>("owner", "New owner address to update to")
  .setAction(async (taskArgs: { owner: string }, {ethers, deployments}) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const qETH = await ethers.getContractAt("Qeth", (await deployments.get("Qeth")).address);
    console.log(`---- QETH ----`);
    console.log(`\taddress: ${await qETH.getAddress()}`);
    console.log(`\tcurrent owner: ${await qETH.owner()}`);
    console.log(`\tnew owner: ${taskArgs.owner}`);

    let answer = await rl.question('Update owner? [y/n] ');
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      const tx = await qETH.transferOwnership(taskArgs.owner)
      console.log(`\ttx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`\ttx mined in block ${receipt?.blockNumber}`);
    } else {
      console.log("skipping QETH")
    }

    const qsd = await ethers.getContractAt("Qsd", (await deployments.get("Qsd")).address);
    console.log(`---- QSD ----`);
    console.log(`\taddress: ${await qsd.getAddress()}`);
    console.log(`\tcurrent owner: ${await qsd.owner()}`);
    console.log(`\tnew owner: ${taskArgs.owner}`);

    answer = await rl.question('Update owner? [y/n] ');
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      const tx = await qsd.transferOwnership(taskArgs.owner)
      console.log(`\ttx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`\ttx mined in block ${receipt?.blockNumber}`);
    } else {
      console.log("skipping QSD")
    }

    const qrt = await ethers.getContractAt("Qrt", (await deployments.get("Qrt")).address);
    console.log(`---- QRT -----`);
    console.log(`\taddress: ${await qrt.getAddress()}`);
    console.log(`\tcurrent owner: ${await qrt.owner()}`);
    console.log(`\tnew owner: ${taskArgs.owner}`);

    answer = await rl.question('Update owner? [y/n] ');
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      const tx = await qrt.transferOwnership(taskArgs.owner)
      console.log(`\ttx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`\ttx mined in block ${receipt?.blockNumber}`);
    } else {
      console.log("skipping QRT")
    }

    const claimVault = await ethers.getContractAt("ClaimVault", (await deployments.get("ClaimVault")).address);
    console.log("---- ClaimVault ----");
    console.log(`\taddress: ${await claimVault.getAddress()}`);
    console.log(`\tcurrent owner: ${await claimVault.owner()}`);
    console.log(`\tnew owner: ${taskArgs.owner}`);

    answer = await rl.question('Update owner? [y/n] ');
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      const tx = await claimVault.transferOwnership(taskArgs.owner)
      console.log(`\ttx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`\ttx mined in block ${receipt?.blockNumber}`);
    } else {
      console.log("skipping Claim Vault");
    }

    const batchClaim = await ethers.getContractAt("BatchClaim", (await deployments.get("BatchClaim")).address);
    console.log("---- BatchClaim ----");
    console.log(`\taddress: ${await batchClaim.getAddress()}`);
    console.log(`\tcurrent owner: ${await batchClaim.owner()}`);
    console.log(`\tnew owner: ${taskArgs.owner}`);

    answer = await rl.question('Update owner? [y/n] ');
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      const tx = await batchClaim.transferOwnership(taskArgs.owner)
      console.log(`\ttx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`\ttx mined in block ${receipt?.blockNumber}`);
    } else {
      console.log("skipping Batch Claim");
    }

    const tokenPriceCalculator = await ethers.getContractAt("TokenPriceCalculator", (await deployments.get("TokenPriceCalculator")).address);
    console.log("---- TokenPriceCalculator ----");
    console.log(`\taddress: ${await tokenPriceCalculator.getAddress()}`);
    console.log(`\tcurrent owner: ${await tokenPriceCalculator.owner()}`);
    console.log(`\tnew owner: ${taskArgs.owner}`);

    answer = await rl.question('Update owner? [y/n] ');
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      const tx = await tokenPriceCalculator.transferOwnership(taskArgs.owner)
      console.log(`\ttx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`\ttx mined in block ${receipt?.blockNumber}`);
    } else {
      console.log("skipping token price calculator");
    }

    const compose = await ethers.getContractAt("Compose", (await deployments.get("Compose")).address);
    console.log("---- Compose ----");
    console.log(`address: ${await compose.getAddress()}`);
    console.log(`current owner: ${await compose.owner()}`);
    console.log(`new owner: ${taskArgs.owner}`);

    answer = await rl.question('Update owner? [y/n] ');
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      const tx = await compose.transferOwnership(taskArgs.owner);
      console.log(`\ttx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`\ttx mined in block ${receipt?.blockNumber}`);
    } else {
      console.log("skipping token price calculator");
    }
  });
