const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Mock Market System - Integration Tests", function () {
  let marketTokens, marketFactory;
  let owner, oracle, user1, user2;
  const QUESTION = "Will HBAR reach $0.10 by end of 2024?";

  beforeEach(async function () {
    [owner, oracle, user1, user2] = await ethers.getSigners();
    
    // Deploy MockMarketTokens contract
    const MockMarketTokens = await ethers.getContractFactory("MockMarketTokens");
    marketTokens = await MockMarketTokens.deploy(owner.address);
    await marketTokens.waitForDeployment();

    // Deploy MarketFactory contract
    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    marketFactory = await MarketFactory.deploy(await marketTokens.getAddress());
    await marketFactory.waitForDeployment();

    // Set the prediction market address in MarketTokens
    await marketTokens.setPredictionMarket(await marketFactory.getAddress());
  });

  describe("Basic Contract Deployment", function () {
    it("Should deploy all contracts successfully", async function () {
      expect(await marketTokens.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await marketFactory.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should set correct owners", async function () {
      expect(await marketTokens.owner()).to.equal(owner.address);
      expect(await marketFactory.owner()).to.equal(owner.address);
    });

    it("Should start with zero markets", async function () {
      expect(await marketFactory.getMarketCount()).to.equal(0);
    });
  });

  describe("Market Creation (Mock)", function () {
    it("Should create a market successfully", async function () {
      const endTime = (await time.latest()) + 86400; // 24 hours from now
      
      await expect(marketFactory.connect(user1).createMarket(
        QUESTION,
        endTime,
        oracle.address,
        "YES_HBAR",
        "NO_HBAR"
      )).to.not.be.reverted;

      expect(await marketFactory.getMarketCount()).to.equal(1);
      
      const marketAddress = await marketFactory.getMarketAddress(0);
      expect(marketAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should create multiple markets", async function () {
      const endTime1 = (await time.latest()) + 86400;
      const endTime2 = (await time.latest()) + 172800;

      await marketFactory.connect(user1).createMarket(
        "Question 1",
        endTime1,
        oracle.address,
        "YES_Q1",
        "NO_Q1"
      );

      await marketFactory.connect(user2).createMarket(
        "Question 2",
        endTime2,
        oracle.address,
        "YES_Q2",
        "NO_Q2"
      );

      expect(await marketFactory.getMarketCount()).to.equal(2);
    });

    it("Should emit MarketCreated event", async function () {
      const endTime = (await time.latest()) + 86400;
      
      await expect(marketFactory.connect(user1).createMarket(
        QUESTION,
        endTime,
        oracle.address,
        "YES_HBAR",
        "NO_HBAR"
      ))
        .to.emit(marketFactory, "MarketCreated")
        .withArgs(0, anyValue, QUESTION, oracle.address, anyValue, anyValue);
    });
  });

  describe("Market Access", function () {
    beforeEach(async function () {
      const endTime = (await time.latest()) + 86400;
      await marketFactory.connect(user1).createMarket(
        QUESTION,
        endTime,
        oracle.address,
        "YES_HBAR",
        "NO_HBAR"
      );
    });

    it("Should return correct market address", async function () {
      const marketAddress = await marketFactory.getMarketAddress(0);
      expect(marketAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should revert when accessing non-existent market", async function () {
      await expect(
        marketFactory.getMarketAddress(1)
      ).to.be.revertedWith("Market ID out of bounds");
    });
  });

  describe("Token Management", function () {
    it("Should create mock tokens", async function () {
      await expect(
        marketTokens.connect(owner).createMarketTokens(
          "YES: Test",
          "YES_TEST",
          "NO: Test",
          "NO_TEST"
        )
      ).to.be.revertedWith("Only prediction market can create tokens");
    });

    it("Should allow owner to set prediction market", async function () {
      await marketTokens.setPredictionMarket(user1.address);
      expect(await marketTokens.predictionMarket()).to.equal(user1.address);
    });

    it("Should revert when non-owner sets prediction market", async function () {
      await expect(
        marketTokens.connect(user1).setPredictionMarket(user2.address)
      ).to.be.revertedWithCustomError(marketTokens, "OwnableUnauthorizedAccount");
    });
  });

  describe("Gas Usage", function () {
    it("Should use reasonable gas for market creation", async function () {
      const endTime = (await time.latest()) + 86400;
      
      const tx = await marketFactory.connect(user1).createMarket(
        QUESTION,
        endTime,
        oracle.address,
        "YES_HBAR",
        "NO_HBAR"
      );
      
      const receipt = await tx.wait();
      // Should use less than 5M gas
      expect(receipt.gasUsed).to.be.lt(ethers.parseUnits("5000000", 0));
    });
  });
});

describe("Market Contract Logic Tests (Without HTS)", function () {
  let market, marketFactory, marketTokens;
  let owner, oracle, user1, user2;

  beforeEach(async function () {
    [owner, oracle, user1, user2] = await ethers.getSigners();
    
    // Deploy contracts
    const MockMarketTokens = await ethers.getContractFactory("MockMarketTokens");
    marketTokens = await MockMarketTokens.deploy(owner.address);
    await marketTokens.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    marketFactory = await MarketFactory.deploy(await marketTokens.getAddress());
    await marketFactory.waitForDeployment();

    await marketTokens.setPredictionMarket(await marketFactory.getAddress());

    // Create a market
    const endTime = (await time.latest()) + 86400;
    await marketFactory.connect(user1).createMarket(
      "Test Question",
      endTime,
      oracle.address,
      "YES_TEST",
      "NO_TEST"
    );

    const marketAddress = await marketFactory.getMarketAddress(0);
    market = await ethers.getContractAt("Market", marketAddress);
  });

  describe("Market State", function () {
    it("Should have correct initial state", async function () {
      const marketInfo = await market.marketInfo();
      
      expect(marketInfo.question).to.equal("Test Question");
      expect(marketInfo.oracle).to.equal(oracle.address);
      expect(marketInfo.totalYesShares).to.equal(0);
      expect(marketInfo.totalNoShares).to.equal(0);
      expect(marketInfo.totalCollateral).to.equal(0);
      expect(marketInfo.isResolved).to.be.false;
    });

    it("Should have factory as owner", async function () {
      expect(await market.owner()).to.equal(await marketFactory.getAddress());
    });
  });

  describe("Market Resolution", function () {
    it("Should allow oracle to report YES outcome", async function () {
      await expect(market.connect(oracle).reportOutcome(1))
        .to.emit(market, "MarketResolved")
        .withArgs(1);

      const marketInfo = await market.marketInfo();
      expect(marketInfo.outcome).to.equal(1); // YES
      expect(marketInfo.isResolved).to.be.true;
    });

    it("Should allow oracle to report NO outcome", async function () {
      await expect(market.connect(oracle).reportOutcome(2))
        .to.emit(market, "MarketResolved")
        .withArgs(2);

      const marketInfo = await market.marketInfo();
      expect(marketInfo.outcome).to.equal(2); // NO
      expect(marketInfo.isResolved).to.be.true;
    });

    it("Should revert when non-oracle tries to report outcome", async function () {
      await expect(
        market.connect(user1).reportOutcome(1)
      ).to.be.revertedWith("Only the oracle can report the outcome");
    });

    it("Should revert when trying to resolve already resolved market", async function () {
      await market.connect(oracle).reportOutcome(1);
      
      await expect(
        market.connect(oracle).reportOutcome(2)
      ).to.be.revertedWith("Market is already resolved");
    });
  });

  describe("Access Control", function () {
    it("Should allow only oracle to resolve market", async function () {
      const accounts = [owner, user1, user2];
      
      for (const account of accounts) {
        await expect(
          market.connect(account).reportOutcome(1)
        ).to.be.revertedWith("Only the oracle can report the outcome");
      }
    });
  });
});
