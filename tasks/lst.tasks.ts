import {task} from "hardhat/config";
import {getLSTAddress} from "./utils";
import {ContractTransactionResponse} from "ethers";
import {USDC_ADDRESSES} from "../constants";
import {boolean} from "hardhat/internal/core/params/argumentTypes";

task("lst:buy", "Buy LST")
  .addParam<"QSD" | "QRT" | "QETH">("lst", "Address of the LST", "QSD")
  .addParam<string>("amount", "Amount of LST to buy", "1.0")
  .addParam<"USDC" | "ETH">("currency", "Currency to use", "ETH")
  .setAction(async (taskArgs: {
      lst: "QSD" | "QRT" | "QETH",
      amount: string,
      currency: "USDC" | "ETH"
    }, {ethers, deployments}) => {
      const lstAddress = await getLSTAddress(deployments, taskArgs.lst);
      const chainId = Number(await ethers.provider.getNetwork().then(network => network.chainId));
      const lst = await ethers.getContractAt("AbstractLST", lstAddress);
      const decimals = taskArgs.currency === "USDC" ? 6 : 18;
      const amount = ethers.parseUnits(taskArgs.amount, decimals);

      console.log(`Buying ${taskArgs.lst} with ${taskArgs.currency}`);
      console.log(`\tAmount: ${amount.toString()}`);
      console.log(`\tChainId: ${chainId}`);
      console.log(`\tLST Address: ${lstAddress}`);

      let tx: ContractTransactionResponse;
      if (taskArgs.currency === "USDC") {
        const usdcAddress = USDC_ADDRESSES[chainId];
        if (!usdcAddress) {
          throw new Error("USDC address not found for chainId: " + chainId);
        }
        const usdc = await ethers.getContractAt("IERC20", usdcAddress);
        console.log("\tApproving USDC...");
        tx = await usdc.approve(lst.getAddress(), amount);
        console.log("\tsubmitted tx with hash: ", tx.hash);
        const rx = await tx.wait();
        console.log("\tconfirmed tx in block: ", rx?.blockNumber);
        tx = await lst.buyTokens(amount);
      } else {
        tx = await lst.buyTokensWithEth({value: amount});
      }

      console.log("submitted tx with hash: ", tx.hash);
      console.log("waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("confirmed tx in block: ", receipt?.blockNumber);
    }
  );

task("lst:list-claim", "List lsts on claim contract")
  .setAction(async (taskArgs, {ethers, deployments}) => {
    const claimAddress = await deployments.get("ClaimVault").then(contract => contract.address);
    const claim = await ethers.getContractAt("ClaimVault", claimAddress);
    const lsts = await claim.getLSTs();
    console.log("Claim contract address: ", claimAddress);
    console.log("LSTs listed on claim contract:");
    for (const lst of lsts) {
      const contract = await ethers.getContractAt("AbstractLST", lst);
      console.log(`\t${lst} (${await contract.symbol()})`);
    }
  });

task("lst:whitelist", "Whitelist an address for use on an LST")
  .addParam<string>("account", "Account to whitelist")
  .addParam<boolean>("whitelisted", "whether the account is whitelisted", true, boolean, true)
  .setAction(async (taskArgs: {
    account: string,
    whitelisted: boolean,
  }, {ethers, deployments}) => {
    if (taskArgs.whitelisted){
      console.log(`Whitelisting account: ${taskArgs.account}`);
    } else {
      console.log(`Removing from whitelist: ${taskArgs.account}`);
    }
    let lsts: ("QSD" | "QRT" | "QETH") [] = ["QSD", "QRT", "QETH"];
    for (let lst of lsts) {
      const contractAddress = await getLSTAddress(deployments, lst);
      const lstContract = await ethers.getContractAt("AbstractLST", contractAddress);
      console.log(`\twhitelisting on ${lst}`);
      const tx = await lstContract.updateWhitelist(taskArgs.account, taskArgs.whitelisted);
      console.log(`\ttx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`tx mined in block: ${receipt?.blockNumber}\n`);
    }
  });