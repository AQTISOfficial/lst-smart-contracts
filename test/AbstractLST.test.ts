import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe("AbstractLST", () => {
  const deployFixture = async () => {
    const maxSupply = ethers.parseEther("1000");
    const alst = await (await ethers.getContractFactory("MockAbstractLST")).deploy(
      "AbstractLST",
      "ALST",
      maxSupply
    );
    return {alst, maxSupply};
  }

  it("should deploy", async () => {
    const {alst} = await loadFixture(deployFixture);
    expect(await alst.getAddress()).to.be.not.empty;
  });

  it("should have a name", async () => {
    const {alst} = await loadFixture(deployFixture);
    expect(await alst.name()).to.equal("AbstractLST");
  });

  it("should have a symbol", async () => {
    const {alst} = await loadFixture(deployFixture);
    expect(await alst.symbol()).to.equal("ALST");
  });

  it("should default to 18 decimals", async () => {
    const {alst} = await loadFixture(deployFixture);
    expect(await alst.decimals()).to.equal(18);
  });

  it("should revert on permissioned functions", async () => {
    const {alst} = await loadFixture(deployFixture);
    const nonAdmin = (await ethers.getSigners())[1];

    await expect(alst.connect(nonAdmin).setBuyActive(true)).to.be
      .revertedWithCustomError(alst, "OwnableUnauthorizedAccount");
    await expect(alst.connect(nonAdmin).setDistributionAddress(nonAdmin.getAddress())).to.be
      .revertedWithCustomError(alst, "OwnableUnauthorizedAccount");
    await expect(alst.connect(nonAdmin).setCap(1000)).to.be
      .revertedWithCustomError(alst, "OwnableUnauthorizedAccount");
    await expect(alst.connect(nonAdmin).setWhitelistActive(true)).to.be
      .revertedWithCustomError(alst, "OwnableUnauthorizedAccount");
    await expect(alst.connect(nonAdmin).updateWhitelist(nonAdmin.getAddress(), true)).to.be
      .revertedWithCustomError(alst, "OwnableUnauthorizedAccount");
  });
});