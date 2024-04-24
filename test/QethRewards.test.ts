import { ethers } from "hardhat";
import { MockQethRewards, MockTokenPriceCalculator } from "../typechain-types";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const FROM = 0;
const TO = 1;

describe("QethRewards", () => {
  const deployFixture = async (): Promise<{
    qethRewards: MockQethRewards,
    tokenPriceCalculator: MockTokenPriceCalculator
  }> => {
    const tokenPriceCalculator = await (
      await ethers.getContractFactory("MockTokenPriceCalculator")
    ).deploy();
    const qethRewards = await (
      await ethers.getContractFactory("MockQethRewards")
    ).deploy();
    await qethRewards.setTokenPriceCalculator(await tokenPriceCalculator.getAddress());
    await tokenPriceCalculator.setAqtisPriceInWETH(ethers.parseEther("0.0001"));
    return {qethRewards, tokenPriceCalculator};
  };

  it("should deploy", async () => {
    const {qethRewards} = await loadFixture(deployFixture);
    expect(await qethRewards.getAddress()).to.be.not.undefined;
  });

  it("should give the correct rewards", async () => {
    const {qethRewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());

    // simulate a balance mint
    const value = ethers.parseEther("5");
    await qethRewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await qethRewards.updateRecord(user, value, TO);

    // wait 10 days
    await time.increase(60 * 60 * 24 * 10);

    const rewards = await qethRewards.getRewardsFor(user);

    // expected eth rewards = 7.5% * 5 qeth * 10 days / 365 days = 0.01027
    expect(
      ethers.formatEther(rewards.ethRewards)
    ).to.satisfy((s: string) => s.startsWith("0.01027"), "should give correct eth rewards")

    // expected aqtis rewards = 2.5% * qeth * 10 days / (365 days * 0.0001 ETH/AQTIS)
    expect(
      ethers.formatEther(rewards.aqtisRewards)
    ).to.satisfy((s: string) => s.startsWith("34.24"), "should give the correct aqtis rewards")

    expect(rewards.usdcRewards).to.equal(0n);
  });

  it("should give the correct rewards for an abnormal period", async () => {
    const {qethRewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());
    const anotherUser = await ethers.getSigners().then(signer => signer[1].getAddress());

    // simulate a balance mint
    let value = ethers.parseEther("5");
    await qethRewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await qethRewards.updateRecord(user, value, TO);

    // wait 5 days
    await time.increase(60 * 60 * 24 * 5);

    // simulate a sell
    value = ethers.parseEther("2");
    await qethRewards.updateRecord(user, value, FROM);
    await qethRewards.updateRecord(anotherUser, value, TO);

    // wait 5 days
    await time.increase(60 * 60 * 24 * 5);

    // twab should be 5*5 + 3*5 /10 = 4
    const rewards = await qethRewards.getRewardsFor(user);

    // expected eth rewards = 7.5% * 4 qeth * 10 days / 365 days = 0.008219
    const twab = await qethRewards.getTWAB(user);
    expect(twab).to.equal(ethers.parseEther("4"));
    expect(
      ethers.formatEther(rewards.ethRewards)
    ).to.satisfy((s: string) => s.startsWith("0.008219"), "should give correct eth rewards")

    // expected aqtis rewards = 2.5% * qeth * 10 days / (365 days * 0.0001 ETH/AQTIS)
    expect(
      ethers.formatEther(rewards.aqtisRewards)
    ).to.satisfy((s: string) => s.startsWith("27.39"), "should give the correct aqtis rewards")
  });

  it("it should not credit rewards to a smart contract", async () => {
    const {qethRewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());

    // just a random contract
    const contractAddress = await (await ethers.getContractFactory("MockTokenPriceCalculator")).deploy()
      .then(c => c.getAddress());

    // simulate a balance mint
    const value = ethers.parseEther("0.05");
    await qethRewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await qethRewards.updateRecord(user, value, TO);

    // wait 5 days
    await time.increase(60 * 60 * 24 * 5);

    // transfer the qeth to the contract
    await qethRewards.updateRecord(user, value, FROM);
    await qethRewards.updateRecord(contractAddress, value, TO);
    // wait 5 days
    await time.increase(60 * 60 * 24 * 5);

    const rewards = await qethRewards.getRewardsFor(contractAddress);
    expect(rewards.ethRewards).to.equal(0n);
    expect(rewards.aqtisRewards).to.equal(0n);
    expect(rewards.usdcRewards).to.equal(0n);

    expect(await qethRewards.getTWAB(user)).to.equal(ethers.parseEther("0.025"));
  });

  it("should not allow non-rewards address to reset user", async () => {
    const {qethRewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[1].getAddress());
    expect(qethRewards.resetUser(user)).to.be.revertedWith("Rewards: Only rewards contract can call this function");
  });

  it("should reset user", async () => {
    const {qethRewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[1].getAddress());
    const caller = await ethers.getSigners().then(signer => signer[0].getAddress());

    await qethRewards.setRewardsAddress(caller);

    // simulate a balance mint
    const value = ethers.parseEther("0.05");
    await qethRewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await qethRewards.updateRecord(user, value, TO);

    // wait 5 days
    await time.increase(60 * 60 * 24 * 5);
    expect(await qethRewards.getTWAB(user)).to.equal(ethers.parseEther("0.05"), "should start with 0.05 twab");

    await qethRewards.resetUser(user);

    expect(await qethRewards.getTWAB(user)).to.equal(0n, "should go to zero after claim");

    // wait 5 days and it should increase again
    await time.increase(60 * 60 * 24 * 5);
    expect(await qethRewards.getTWAB(user)).to.equal(ethers.parseEther("0.05"), "should end with 0.05 twab");
  });
});
