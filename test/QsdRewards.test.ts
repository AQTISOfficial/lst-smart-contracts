import { ethers } from "hardhat";
import { MockQsdRewards, MockTokenPriceCalculator } from "../typechain-types";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const FROM = 0;
const TO = 1;

describe("QsdRewards", () => {
  const deployFixture = async (): Promise<{
    qsdRewards: MockQsdRewards,
    tokenPriceCalculator: MockTokenPriceCalculator
  }> => {
    const tokenPriceCalculator = await (
      await ethers.getContractFactory("MockTokenPriceCalculator")
    ).deploy();
    const qsdRewards = await (
      await ethers.getContractFactory("MockQsdRewards")
    ).deploy();

    await qsdRewards.setTokenPriceCalculator(await tokenPriceCalculator.getAddress());
    await tokenPriceCalculator.setAqtisPriceInUSD(ethers.parseEther("0.01"));
    return {qsdRewards, tokenPriceCalculator};
  };

  it("should deploy", async () => {
    const {qsdRewards} = await loadFixture(deployFixture);
    expect(await qsdRewards.getAddress()).to.be.not.undefined;
  });

  it('should give the correct rewards', async () => {
    const {qsdRewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());

    // simulate a balance mint
    const value = ethers.parseUnits("100", 6);
    await qsdRewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await qsdRewards.updateRecord(user, value, TO);

    // wait 10 days
    await time.increase(60 * 60 * 24 * 10);

    const rewards = await qsdRewards.getRewardsFor(user);

    // expected eth rewards = 12.5% * 100 qsd * 10 days / 365 days = 0.4109
    expect(
      ethers.formatUnits(rewards.usdcRewards, 6)
    ).to.satisfy((s: string) => s.startsWith("0.3424"), "should give correct qsd rewards")

    // expected aqtis rewards = 2.5% * 100 QSD * 10 days / (365 days * 0.01 USD/AQTIS)
    expect(
      ethers.formatEther(rewards.aqtisRewards)
    ).to.satisfy((s: string) => s.startsWith("6.849"), "should give the correct aqtis rewards")

    expect(rewards.cappedLSTRewards).to.equal(0n);
    expect(rewards.ethRewards).to.equal(0n);
  });
});