import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const FROM = 0;
const TO = 1;

describe("QrtRewards", () => {
  const deployFixture = async () => {
    const tokenPriceCalculator = await (
      await ethers.getContractFactory("MockTokenPriceCalculator")
    ).deploy();

    const qrtRewards = await (
      await ethers.getContractFactory("MockQrtRewards")
    ).deploy();

    await qrtRewards.setTokenPriceCalculator(await tokenPriceCalculator.getAddress());
    await tokenPriceCalculator.setAqtisPriceInUSD(ethers.parseUnits("0.02", 18));
    return {qrtRewards};
  }

  it("should deploy", async () => {
    const {qrtRewards} = await loadFixture(deployFixture);
    expect(await qrtRewards.getAddress()).to.be.not.undefined;
  });

  it("should give the correct rewards", async () => {
    const {qrtRewards} = await loadFixture(deployFixture);
    const user = await ethers.getSigners().then(signer => signer[0].getAddress());

    // simulate a balance mint
    const value = ethers.parseUnits("100", 6);
    await qrtRewards.updateRecord(ethers.ZeroAddress, value, FROM);
    await qrtRewards.updateRecord(user, value, TO);

    // wait 10 days
    await time.increase(60 * 60 * 24 * 10);

    const rewards = await qrtRewards.getRewardsFor(user);

    // expected eth rewards = 15% * 100 qrt * 10 days / 365 days = 0.4109
    expect(
      ethers.formatUnits(rewards.cappedLSTRewards, 6)
    ).to.satisfy((s: string) => s.startsWith("0.4109"), "should give correct qrt rewards")

    // expected aqtis rewards = 2.5% * 100 QRT * 10 days * 10 USD/QRT / (365 days * 0.02 USD/AQTIS)
    expect(
      ethers.formatEther(rewards.aqtisRewards)
    ).to.satisfy((s: string) => s.startsWith("34.24"), "should give the correct aqtis rewards")

    expect(rewards.usdcRewards).to.equal(0n);
    expect(rewards.ethRewards).to.equal(0n);
  });
});