import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { MockMintingBonus, Qeth } from "../typechain-types";

describe("MintingBonus", () => {

  const deployFixture = async () => {
    const qeth = await (await ethers.getContractFactory("Qeth")).deploy();
    const mintingBonus = await (await ethers.getContractFactory("MockMintingBonus")).deploy();
    await qeth.setBuyActive(true);
    await qeth.setDistributionAddress((await ethers.getSigners())[0].getAddress());
    return {qeth, mintingBonus};
  }

  const initializeRewardProgram = async (mintingBonus: MockMintingBonus, qeth: Qeth) => {
    const currentBlockTimestamp = (await ethers.provider.getBlock("latest"))?.timestamp
    expect(currentBlockTimestamp).to.be.not.undefined;
    const rewardAmount = ethers.parseUnits("100", 18);
    await mintingBonus.initializeBonusProgram(
      qeth.getAddress(),
      60 * 60 * 24 * 30,
      currentBlockTimestamp!,
      rewardAmount,
      rewardAmount / 2n
    );
    return {currentBlockTimestamp, rewardAmount};
  }

  it("should deploy", async () => {
    const {mintingBonus} = await loadFixture(deployFixture);
    expect(await mintingBonus.getAddress()).to.be.not.empty;
  });

  it("should set bonus program", async () => {
    const {mintingBonus, qeth} = await loadFixture(deployFixture);
    const {rewardAmount, currentBlockTimestamp} = await initializeRewardProgram(mintingBonus, qeth);


    const bonusProgram = await mintingBonus.getRewardsSettings(qeth.getAddress());
    expect(bonusProgram.startTime).to.be
      .eq(currentBlockTimestamp, "start time should be equal to current block time");
    expect(bonusProgram.activeTime).to.be
      .eq(60 * 60 * 24 * 30, "active time should be 30 days");
    expect(bonusProgram.totalRewards).to.be
      .eq(rewardAmount, "total rewards should be equal to reward amount");
    expect(bonusProgram.remainingRewards).to.be
      .eq(rewardAmount, "remaining rewards should be equal to total rewards");
    expect(bonusProgram.maxClaim).to.be
      .eq(rewardAmount / 2n, "max claim should be half of total rewards");
  });

  it("should calculate the correct bonus", async () => {
    const {mintingBonus, qeth} = await loadFixture(deployFixture);
    const {rewardAmount} = await initializeRewardProgram(mintingBonus, qeth);

    // create a balance for a user
    const signer = (await ethers.getSigners())[1];
    await qeth.connect(signer).buyTokensWithEth({value: ethers.parseUnits("1", 18)});

    // send some to a different user
    const signer2 = (await ethers.getSigners())[2];
    await qeth.connect(signer).transfer(signer2.getAddress(), ethers.parseUnits("0.5", 18));

    // wait 1 day
    await time.increase(60 * 60 * 24);

    // calculate the bonus
    const bonus = await mintingBonus.claimableBonusRewards(qeth.getAddress(), signer.getAddress());

    // not exact due to sending to another user at later block time (within 0.01%)
    expect(bonus).to.be.closeTo(rewardAmount / 60n, (rewardAmount / 60n) / 10000n)
  });

  it("should return 0 bonus if no bonus program is set", async () => {
    const {qeth, mintingBonus} = await loadFixture(deployFixture);

    // create a balance for a user
    const signer = (await ethers.getSigners())[1];
    await qeth.connect(signer).buyTokensWithEth({value: ethers.parseUnits("1", 18)});

    await time.increase(60 * 60 * 24);

    expect(await mintingBonus.claimableBonusRewards(qeth.getAddress(), signer.getAddress())).to.be.eq(0);
  });

  it("should return 0 bonus if user has no balance", async () => {
    const {qeth, mintingBonus} = await loadFixture(deployFixture);
    await initializeRewardProgram(mintingBonus, qeth);

    const signer = (await ethers.getSigners())[1];
    expect(await mintingBonus.claimableBonusRewards(qeth.getAddress(), signer.getAddress())).to.be.eq(0);
  });

  it("should return 0 bonus if program has ended", async () => {
    const {qeth, mintingBonus} = await loadFixture(deployFixture);
    const {rewardAmount, currentBlockTimestamp} = await initializeRewardProgram(mintingBonus, qeth);

    // wait till end of program
    await time.increase(60 * 60 * 24 * 31);

    // create a balance for a user
    const signer = (await ethers.getSigners())[1];
    await qeth.connect(signer).buyTokensWithEth({value: ethers.parseUnits("1", 18)});

    expect(await mintingBonus.claimableBonusRewards(qeth.getAddress(), signer.getAddress())).to.be.eq(0);
  });

});