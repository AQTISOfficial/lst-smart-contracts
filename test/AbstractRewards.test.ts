import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const FROM = 0;
const TO = 1;

describe("AbstractRewards", () => {
  const deployFixture = async () => {
    const rewards = await (
      await ethers.getContractFactory("MockAbstractRewards")
    ).deploy(100, 50);
    return {rewards};
  }

  it("should deploy", async () => {
    const {rewards} = await loadFixture(deployFixture);
    expect(await rewards.getAddress()).to.be.not.undefined;
  });

  it("should update circulating supply on mint to address", async () => {
    const {rewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());

    // simulate a balance mint
    const value = ethers.parseUnits("100", 6);
    await rewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await rewards.updateRecord(user, value, TO);

    expect(await rewards.circulatingSupply()).to.equal(value);
  });

  it("should update circulating supply on burn from address", async () => {
    const {rewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());

    // simulate a balance mint
    const value = ethers.parseUnits("100", 6);
    await rewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await rewards.updateRecord(user, value, TO);

    expect(await rewards.circulatingSupply()).to.equal(value);

    // simulate a balance burn
    await rewards.updateRecord(user, value, FROM);
    await rewards.updateRecord(ethers.ZeroAddress, value, TO);

    expect(await rewards.circulatingSupply()).to.equal(0n);
  });

  it("should not update circulating supply on transfer to user address", async () => {
    const {rewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());
    const anotherUser = await ethers.getSigners().then(signer => signer[1].getAddress());

    // simulate a balance mint
    const value = ethers.parseUnits("100", 6);
    await rewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await rewards.updateRecord(user, value, TO);

    expect(await rewards.circulatingSupply()).to.equal(value);

    // simulate a balance transfer
    await rewards.updateRecord(user, value, FROM);
    await rewards.updateRecord(anotherUser, value, TO);

    expect(await rewards.circulatingSupply()).to.equal(value);
  });

  it("should not update circulating supply on mint to contract", async () => {
    const {rewards} = await loadFixture(deployFixture);
    const contract = await (await ethers.getContractFactory("MockUSD")).deploy();
    const value = ethers.parseUnits("100", 6);

    await rewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await rewards.updateRecord(contract.getAddress(), value, TO);

    expect(await rewards.circulatingSupply()).to.equal(0n);
  });

  it("should update circulating supply on mint to whitelisted contract", async () => {
    const {rewards} = await loadFixture(deployFixture);
    const contract = await (await ethers.getContractFactory("MockUSD")).deploy();

    // whitelist
    await rewards.setContractRewardsWhitelist(contract.getAddress(), true);

    const value = ethers.parseUnits("100", 6);

    await rewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await rewards.updateRecord(contract.getAddress(), value, TO);

    expect(await rewards.circulatingSupply()).to.equal(value);
  });

  it("should track average balance", async () => {
    const {rewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());
    const anotherUser = await ethers.getSigners().then(signer => signer[1].getAddress());
    const month = 60n * 60n * 24n * 30n;

    // simulate a balance mint
    const value = ethers.parseUnits("100", 6);
    await rewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await rewards.updateRecord(user, value, TO);

    // wait a month
    await time.increase(month);


    // simulate a balance mint
    const anotherValue = ethers.parseUnits("200", 6);
    await rewards.updateRecord(ethers.ZeroAddress, anotherValue, FROM);
    await rewards.updateRecord(user, anotherValue, TO);

    // wait a month
    await time.increase(month);

    // simulate a transfer
    const yetAnotherValue = ethers.parseUnits("50", 6);
    await rewards.updateRecord(user, yetAnotherValue, FROM);
    await rewards.updateRecord(anotherUser, yetAnotherValue, TO);

    // wait a month
    await time.increase(60 * 60 * 24 * 30);

    const averageValue = (value * month + (value + anotherValue) * month + (value + anotherValue - yetAnotherValue) * month) / (3n * month);
    const averageBalance = await rewards.userTWAB(user);

    expect(averageBalance).to.closeTo(averageValue, 50n);
  });

  it("should reset a user", async () => {
    const {rewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());
    const anotherUser = await ethers.getSigners().then(signer => signer[1].getAddress());
    await rewards.setRewardsAddress(user);

    // simulate a balance mint
    const value = ethers.parseUnits("100", 6);
    await rewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await rewards.updateRecord(user, value, TO);


    expect(await rewards.beforeResetCalled()).to.equal(false);

    // wait a month
    await time.increase(60 * 60 * 24 * 30);

    const averageBalance = await rewards.userTWAB(user);
    expect(averageBalance).to.equal(value);

    await rewards.resetUser(user);
    const cumulativeCirculatingSupply = await rewards.cumulativeCirculatingSupply();

    const newAverageBalance = await rewards.userTWAB(user);
    expect(await rewards.beforeResetCalled()).to.equal(true);
    expect(newAverageBalance).to.equal(0n);

    // change circulating supply
    await rewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await rewards.updateRecord(anotherUser, value, TO);

    const userCumCirculatingSupply = await rewards.cumulativeCirculatingSupplyLastClaim(user);
    expect(userCumCirculatingSupply).to.equal(cumulativeCirculatingSupply);
  });
});