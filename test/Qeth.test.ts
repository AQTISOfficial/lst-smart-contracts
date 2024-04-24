import { ethers } from "hardhat";
import { Qeth } from "../typechain-types";
import { expect } from "chai";

describe("Qeth - Basics", () => {
  const deployFixture = async (): Promise<{ qeth: Qeth }> => {
    const qeth = await (await ethers.getContractFactory("Qeth")).deploy();
    return {qeth};
  }
  it("should deploy", async () => {
    const {qeth} = await deployFixture();
    expect(await qeth.getAddress()).to.be.not.undefined;
  });

  it("should have a name", async () => {
    const {qeth} = await deployFixture();
    expect(await qeth.name()).to.equal("qETH");
  });

  it("should have a symbol", async () => {
    const {qeth} = await deployFixture();
    expect(await qeth.symbol()).to.equal("qETH");
  });

  it("should have 18 decimals", async () => {
    const {qeth} = await deployFixture();
    expect(await qeth.decimals()).to.equal(18);
  });

  it("should have a total supply", async () => {
    const {qeth} = await deployFixture();
    expect(await qeth.totalSupply()).to.equal(0);
  });

  it("should have a soft cap", async () => {
    const {qeth} = await deployFixture();
    expect(await qeth.cap()).to.equal(50_000n * 10n ** 18n);
  });

  it("should have 10% apy", async () => {
    const {qeth} = await deployFixture();
    const apy = await qeth.apy();
    const denominator = await qeth.DENOMINATOR();
    expect(Number(apy) / Number(denominator)).to.equal(0.1);
  });

  it("should have 2.5% aqtis apy", async () => {
    const {qeth} = await deployFixture();
    const apy = await qeth.aqtisApy();
    const denominator = await qeth.DENOMINATOR();
    expect(Number(apy) / Number(denominator)).to.equal(0.025);
  });
});

describe("Qeth - Minting", () => {
  const deployFixture = async (): Promise<{ qeth: Qeth }> => {
    const qeth = await (await ethers.getContractFactory("Qeth")).deploy();
    await qeth.setBuyActive(true);
    const distributorAddress = await ethers.getSigners().then(signer => signer[1].getAddress());
    await qeth.setDistributionAddress(distributorAddress);
    return {qeth};
  }

  it("should be able to buy", async () => {
    const {qeth} = await deployFixture();

    const address = await ethers.getSigners().then(signer => signer[0].getAddress());
    const ethBalanceBefore = await ethers.provider.getBalance(address);
    const qethBalanceBefore = await qeth.balanceOf(address);

    expect(await qeth.buyTokensWithEth({value: ethers.parseEther("1")})).to.emit(qeth, "Transfer");

    const ethBalanceAfter = await ethers.provider.getBalance(address);
    const qethBalanceAfter = await qeth.balanceOf(address);

    expect(ethBalanceBefore - ethBalanceAfter).to.be.gt(ethers.parseEther("1"));
    expect(qethBalanceAfter - qethBalanceBefore).to.equal(ethers.parseEther("1"));
  });

  it("should forward the eth to the distributor", async () => {
    const {qeth} = await deployFixture();
    const distributorAddress = await ethers.getSigners().then(signer => signer[1].getAddress());
    const ethBalanceBefore = await ethers.provider.getBalance(distributorAddress);
    expect(await qeth.buyTokensWithEth({value: ethers.parseEther("1")})).to.emit(qeth, "Transfer");

    const ethBalanceAfter = await ethers.provider.getBalance(distributorAddress);
    expect(ethBalanceAfter - ethBalanceBefore).to.equal(ethers.parseEther("1"));
  });

  it("should not be able to buy if buy is not active", async () => {
    const {qeth} = await deployFixture();
    await qeth.setBuyActive(false);
    await expect(qeth.buyTokensWithEth({value: ethers.parseEther("1")})).to.be.revertedWith("Abstract LST: buy not active");
  });
});