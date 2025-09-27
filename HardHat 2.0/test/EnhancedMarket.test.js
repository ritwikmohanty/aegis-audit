const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Enhanced Market with AMM and AI Integration", function () {
  let market, marketTokens, marketFactory;
  let owner, oracle, user1, user2, contractToAnalyze;
  let yesTokenAddress, noTokenAddress;
  const QUESTION = "Does test contract contain exploitable vulnerabilities?";
  const CONTRACT_HASH = "abc123def456";
  const CONFIDENCE_SCORE = 7500; // 75%
  const YES_SYMBOL = "VUL_abc123";
  const NO_SYMBOL = "SEC_abc123";

  beforeEach(async function () {
    [owner, oracle, user1, user2, contractToAnalyze] = await ethers.getSigners();
    
    // Deploy MarketTokens contract
    const MarketTokens = await ethers.getContractFactory("MarketTokens");
    marketTokens = await MarketTokens.deploy(owner.address);
    await marketTokens.waitForDeployment();

    // Deploy MarketFactory contract
    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    marketFactory = await MarketFactory.deploy(await marketTokens.getAddress());
    await marketFactory.waitForDeployment();

    // Set the prediction market address in MarketTokens
    await marketTokens.setPredictionMarket(await marketFactory.getAddress());

    // Create a market through AI analysis
    const endTime = (await time.latest()) + 86400; // 24 hours from now
    const tx = await marketFactory.createMarketFromAnalysis(
      contractToAnalyze.address,
      CONTRACT_HASH,
      CONFIDENCE_SCORE,
      endTime,
      oracle.address
    );
    await tx.wait();

    // Get the deployed market address
    const marketAddress = await marketFactory.getMarketAddress(0);
    market = await ethers.getContractAt("Market", marketAddress);

    // Get token addresses from the market
    const marketInfo = await market.marketInfo();
    yesTokenAddress = marketInfo.yesTokenAddress;
    noTokenAddress = marketInfo.noTokenAddress;
  });

  describe("AI Integration Features", function () {
    it("Should create market with correct AI analysis data", async function () {
      const marketInfo = await market.marketInfo();
      
      expect(marketInfo.contractToAnalyze).to.equal(contractToAnalyze.address);
      expect(marketInfo.contractHash).to.equal(CONTRACT_HASH);
      expect(marketInfo.confidenceScore).to.equal(CONFIDENCE_SCORE);
      expect(marketInfo.createdAt).to.be.gt(0);
    });

    it("Should set analysis report hash by oracle", async function () {
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("analysis report"));
      
      await market.connect(oracle).setAnalysisReportHash(reportHash);
      
      const marketInfo = await market.marketInfo();
      expect(marketInfo.analysisReportHash).to.equal(reportHash);
    });

    it("Should not allow non-oracle to set report hash", async function () {
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("analysis report"));
      
      await expect(
        market.connect(user1).setAnalysisReportHash(reportHash)
      ).to.be.revertedWith("Only oracle can set report hash");
    });

    it("Should not allow setting report hash twice", async function () {
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("analysis report"));
      
      await market.connect(oracle).setAnalysisReportHash(reportHash);
      
      await expect(
        market.connect(oracle).setAnalysisReportHash(reportHash)
      ).to.be.revertedWith("Report hash already set");
    });
  });

  describe("AMM Pricing Mechanism", function () {
    it("Should calculate initial token prices correctly", async function () {
      const yesPrice = await market.getCurrentTokenPrice(true);
      const noPrice = await market.getCurrentTokenPrice(false);
      
      // Initially, prices should be equal since no tokens have been purchased
      expect(yesPrice).to.be.gt(0);
      expect(noPrice).to.be.gt(0);
      expect(yesPrice).to.equal(noPrice);
    });

    it("Should calculate odds correctly", async function () {
      const [yesOdds, noOdds] = await market.getCurrentOdds();
      
      // Initially, odds should be 50/50 (5000 basis points each)
      expect(yesOdds).to.equal(5000);
      expect(noOdds).to.equal(5000);
      expect(yesOdds + noOdds).to.equal(10000);
    });

    it("Should update prices after token purchases", async function () {
      const initialYesPrice = await market.getCurrentTokenPrice(true);
      const purchaseAmount = ethers.parseEther("100");
      
      // Calculate required payment
      const cost = await market.calculateTokenPrice(true, purchaseAmount);
      
      // Buy YES tokens
      await market.connect(user1).buyTokens(true, purchaseAmount, { value: cost });
      
      const newYesPrice = await market.getCurrentTokenPrice(true);
      const newNoPrice = await market.getCurrentTokenPrice(false);
      
      // YES price should increase, NO price should decrease
      expect(newYesPrice).to.be.gt(initialYesPrice);
      expect(newNoPrice).to.be.lt(initialYesPrice);
    });

    it("Should refund excess payment", async function () {
      const purchaseAmount = ethers.parseEther("100");
      const cost = await market.calculateTokenPrice(true, purchaseAmount);
      const excessPayment = ethers.parseEther("10");
      
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      const tx = await market.connect(user1).buyTokens(true, purchaseAmount, { 
        value: cost + excessPayment 
      });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(user1.address);
      
      // User should only pay the exact cost plus gas
      expect(initialBalance - finalBalance).to.be.closeTo(cost + gasUsed, ethers.parseEther("0.01"));
    });

    it("Should update odds based on token purchases", async function () {
      const purchaseAmount = ethers.parseEther("1000");
      const cost = await market.calculateTokenPrice(true, purchaseAmount);
      
      // Buy a significant amount of YES tokens
      await market.connect(user1).buyTokens(true, purchaseAmount, { value: cost });
      
      const [yesOdds, noOdds] = await market.getCurrentOdds();
      
      // YES odds should decrease (more likely), NO odds should increase
      expect(yesOdds).to.be.lt(5000);
      expect(noOdds).to.be.gt(5000);
      expect(yesOdds + noOdds).to.equal(10000);
    });

    it("Should handle large purchases correctly", async function () {
      const largePurchase = ethers.parseEther("10000");
      const cost = await market.calculateTokenPrice(true, largePurchase);
      
      await expect(
        market.connect(user1).buyTokens(true, largePurchase, { value: cost })
      ).to.not.be.reverted;
      
      const marketInfo = await market.marketInfo();
      expect(marketInfo.totalYesShares).to.equal(largePurchase);
    });
  });

  describe("Market Expiration", function () {
    it("Should not allow buying tokens after expiration", async function () {
      // Fast forward past market end time
      await time.increaseTo((await time.latest()) + 86401);
      
      const purchaseAmount = ethers.parseEther("100");
      const cost = await market.calculateTokenPrice(true, purchaseAmount);
      
      await expect(
        market.connect(user1).buyTokens(true, purchaseAmount, { value: cost })
      ).to.be.revertedWith("Market has expired");
    });

    it("Should allow resolving expired market as INVALID", async function () {
      // Fast forward past market end time
      await time.increaseTo((await time.latest()) + 86401);
      
      await market.connect(user1).resolveExpiredMarket();
      
      const marketInfo = await market.marketInfo();
      expect(marketInfo.isResolved).to.be.true;
      expect(marketInfo.outcome).to.equal(3); // INVALID
    });

    it("Should not allow resolving non-expired market", async function () {
      await expect(
        market.connect(user1).resolveExpiredMarket()
      ).to.be.revertedWith("Market has not expired yet");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to emergency resolve as INVALID", async function () {
      await market.connect(owner).emergencyResolveAsInvalid();
      
      const marketInfo = await market.marketInfo();
      expect(marketInfo.isResolved).to.be.true;
      expect(marketInfo.outcome).to.equal(3); // INVALID
    });

    it("Should not allow non-owner to emergency resolve", async function () {
      await expect(
        market.connect(user1).emergencyResolveAsInvalid()
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("Market Factory AI Integration", function () {
    it("Should emit correct events for AI-created market", async function () {
      const endTime = (await time.latest()) + 86400;
      
      await expect(
        marketFactory.createMarketFromAnalysis(
          user2.address,
          "xyz789",
          8000,
          endTime,
          oracle.address
        )
      )
        .to.emit(marketFactory, "MarketCreated")
        .and.to.emit(marketFactory, "MarketCreatedFromAnalysis");
    });

    it("Should validate input parameters", async function () {
      const endTime = (await time.latest()) + 86400;
      
      // Invalid contract address
      await expect(
        marketFactory.createMarketFromAnalysis(
          ethers.ZeroAddress,
          "xyz789",
          8000,
          endTime,
          oracle.address
        )
      ).to.be.revertedWith("Contract address cannot be zero");

      // Empty contract hash
      await expect(
        marketFactory.createMarketFromAnalysis(
          user2.address,
          "",
          8000,
          endTime,
          oracle.address
        )
      ).to.be.revertedWith("Contract hash cannot be empty");

      // Invalid confidence score
      await expect(
        marketFactory.createMarketFromAnalysis(
          user2.address,
          "xyz789",
          10001,
          endTime,
          oracle.address
        )
      ).to.be.revertedWith("Confidence score must be <= 10000");
    });
  });

  describe("Integration with Existing Functionality", function () {
    it("Should work with existing claim winnings flow", async function () {
      const purchaseAmount = ethers.parseEther("100");
      const yesCost = await market.calculateTokenPrice(true, purchaseAmount);
      const noCost = await market.calculateTokenPrice(false, purchaseAmount);
      
      // Users buy tokens
      await market.connect(user1).buyTokens(true, purchaseAmount, { value: yesCost });
      await market.connect(user2).buyTokens(false, purchaseAmount, { value: noCost });
      
      // Oracle resolves market
      await market.connect(oracle).reportOutcome(1); // YES wins
      
      // Winner claims tokens
      const initialBalance = await ethers.provider.getBalance(user1.address);
      const tx = await market.connect(user1).claimWinnings();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance).to.be.gt(initialBalance - gasUsed);
    });
  });
});