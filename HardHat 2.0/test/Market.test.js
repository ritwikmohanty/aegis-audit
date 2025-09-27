const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Market Contract", function () {
  let market, marketTokens, marketFactory;
  let owner, oracle, user1, user2;
  let yesTokenAddress, noTokenAddress;
  const QUESTION = "Will HBAR reach $0.10 by end of 2024?";
  const YES_SYMBOL = "YES_HBAR";
  const NO_SYMBOL = "NO_HBAR";

  beforeEach(async function () {
    [owner, oracle, user1, user2] = await ethers.getSigners();
    
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

    // Create a market through the factory
    const endTime = (await time.latest()) + 86400; // 24 hours from now
    const tx = await marketFactory.createMarket(
      QUESTION,
      endTime,
      oracle.address,
      YES_SYMBOL,
      NO_SYMBOL
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

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      const marketInfo = await market.marketInfo();
      
      expect(marketInfo.question).to.equal(QUESTION);
      expect(marketInfo.oracle).to.equal(oracle.address);
      expect(marketInfo.yesTokenAddress).to.equal(yesTokenAddress);
      expect(marketInfo.noTokenAddress).to.equal(noTokenAddress);
      expect(marketInfo.totalYesShares).to.equal(0);
      expect(marketInfo.totalNoShares).to.equal(0);
      expect(marketInfo.totalCollateral).to.equal(0);
      expect(marketInfo.isResolved).to.be.false;
    });

    it("Should set the factory as owner", async function () {
      expect(await market.owner()).to.equal(await marketFactory.getAddress());
    });
  });

  describe("Token Purchasing", function () {
    it("Should allow users to buy YES tokens", async function () {
      const amount = ethers.parseEther("1.0");
      
      await expect(market.connect(user1).buyTokens(true, amount, { value: amount }))
        .to.emit(market, "TokensPurchased")
        .withArgs(user1.address, true, amount, amount);

      const yesShares = await market.yesShares(user1.address);
      expect(yesShares).to.equal(amount);

      const marketInfo = await market.marketInfo();
      expect(marketInfo.totalYesShares).to.equal(amount);
      expect(marketInfo.totalCollateral).to.equal(amount);
    });

    it("Should allow users to buy NO tokens", async function () {
      const amount = ethers.parseEther("1.0");
      
      await expect(market.connect(user1).buyTokens(false, amount, { value: amount }))
        .to.emit(market, "TokensPurchased")
        .withArgs(user1.address, false, amount, amount);

      const noShares = await market.noShares(user1.address);
      expect(noShares).to.equal(amount);

      const marketInfo = await market.marketInfo();
      expect(marketInfo.totalNoShares).to.equal(amount);
      expect(marketInfo.totalCollateral).to.equal(amount);
    });

    it("Should allow multiple users to buy tokens", async function () {
      const amount1 = ethers.parseEther("1.0");
      const amount2 = ethers.parseEther("2.0");

      await market.connect(user1).buyTokens(true, amount1, { value: amount1 });
      await market.connect(user2).buyTokens(false, amount2, { value: amount2 });

      const user1YesShares = await market.yesShares(user1.address);
      const user2NoShares = await market.noShares(user2.address);
      
      expect(user1YesShares).to.equal(amount1);
      expect(user2NoShares).to.equal(amount2);

      const marketInfo = await market.marketInfo();
      expect(marketInfo.totalYesShares).to.equal(amount1);
      expect(marketInfo.totalNoShares).to.equal(amount2);
      expect(marketInfo.totalCollateral).to.equal(amount1 + amount2);
    });

    it("Should revert when payment doesn't match token amount", async function () {
      const amount = ethers.parseEther("1.0");
      const payment = ethers.parseEther("0.5");
      
      await expect(
        market.connect(user1).buyTokens(true, amount, { value: payment })
      ).to.be.revertedWith("Payment must match token amount");
    });

    it("Should revert when no payment is sent", async function () {
      const amount = ethers.parseEther("1.0");
      
      await expect(
        market.connect(user1).buyTokens(true, amount)
      ).to.be.revertedWith("Must send HBAR to buy tokens");
    });

    it("Should revert when market is resolved", async function () {
      // First resolve the market
      await market.connect(oracle).reportOutcome(1); // YES outcome
      
      const amount = ethers.parseEther("1.0");
      await expect(
        market.connect(user1).buyTokens(true, amount, { value: amount })
      ).to.be.revertedWith("Market is already resolved");
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

    it("Should allow oracle to report INVALID outcome", async function () {
      await expect(market.connect(oracle).reportOutcome(3))
        .to.emit(market, "MarketResolved")
        .withArgs(3);

      const marketInfo = await market.marketInfo();
      expect(marketInfo.outcome).to.equal(3); // INVALID
      expect(marketInfo.isResolved).to.be.true;
    });

    it("Should revert when non-oracle tries to report outcome", async function () {
      await expect(
        market.connect(user1).reportOutcome(1)
      ).to.be.revertedWith("Only the oracle can report the outcome");
    });

    it("Should revert when trying to report PENDING outcome", async function () {
      await expect(
        market.connect(oracle).reportOutcome(0)
      ).to.be.revertedWith("Invalid outcome");
    });

    it("Should revert when trying to resolve already resolved market", async function () {
      await market.connect(oracle).reportOutcome(1);
      
      await expect(
        market.connect(oracle).reportOutcome(2)
      ).to.be.revertedWith("Market is already resolved");
    });
  });

  describe("Winnings Claiming", function () {
    beforeEach(async function () {
      // Set up a market with bets
      const amount1 = ethers.parseEther("2.0");
      const amount2 = ethers.parseEther("3.0");
      
      await market.connect(user1).buyTokens(true, amount1, { value: amount1 });
      await market.connect(user2).buyTokens(false, amount2, { value: amount2 });
    });

    it("Should allow YES token holders to claim winnings when YES wins", async function () {
      // Resolve market as YES
      await market.connect(oracle).reportOutcome(1);
      
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      await expect(market.connect(user1).claimWinnings())
        .to.emit(market, "WinningsClaimed")
        .withArgs(user1.address, anyValue);

      const finalBalance = await ethers.provider.getBalance(user1.address);
      const marketInfo = await market.marketInfo();
      
      // User should receive their proportional share of total collateral
      const expectedWinnings = (await market.yesShares(user1.address) * marketInfo.totalCollateral) / marketInfo.totalYesShares;
      expect(finalBalance - initialBalance).to.be.closeTo(expectedWinnings, ethers.parseEther("0.01"));
    });

    it("Should allow NO token holders to claim winnings when NO wins", async function () {
      // Resolve market as NO
      await market.connect(oracle).reportOutcome(2);
      
      const initialBalance = await ethers.provider.getBalance(user2.address);
      
      await expect(market.connect(user2).claimWinnings())
        .to.emit(market, "WinningsClaimed")
        .withArgs(user2.address, anyValue);

      const finalBalance = await ethers.provider.getBalance(user2.address);
      const marketInfo = await market.marketInfo();
      
      // User should receive their proportional share of total collateral
      const expectedWinnings = (await market.noShares(user2.address) * marketInfo.totalCollateral) / marketInfo.totalNoShares;
      expect(finalBalance - initialBalance).to.be.closeTo(expectedWinnings, ethers.parseEther("0.01"));
    });

    it("Should not allow claiming when market has INVALID outcome", async function () {
      // Resolve market as INVALID
      await market.connect(oracle).reportOutcome(3);
      
      await expect(
        market.connect(user1).claimWinnings()
      ).to.be.revertedWith("No winning token for this outcome");
    });

    it("Should revert when claiming without winning shares", async function () {
      // Resolve market as YES
      await market.connect(oracle).reportOutcome(1);
      
      // user2 only has NO tokens, so they can't claim YES winnings
      await expect(
        market.connect(user2).claimWinnings()
      ).to.be.revertedWith("No winning shares to claim");
    });

    it("Should revert when claiming from unresolved market", async function () {
      await expect(
        market.connect(user1).claimWinnings()
      ).to.be.revertedWith("Market is not resolved");
    });

    it("Should zero out user shares after claiming", async function () {
      await market.connect(oracle).reportOutcome(1);
      
      const initialShares = await market.yesShares(user1.address);
      expect(initialShares).to.be.gt(0);
      
      await market.connect(user1).claimWinnings();
      
      const finalShares = await market.yesShares(user1.address);
      expect(finalShares).to.equal(0);
    });

    it("Should not allow claiming twice", async function () {
      await market.connect(oracle).reportOutcome(1);
      
      await market.connect(user1).claimWinnings();
      
      await expect(
        market.connect(user1).claimWinnings()
      ).to.be.revertedWith("No winning shares to claim");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount purchases gracefully", async function () {
      await expect(
        market.connect(user1).buyTokens(true, 0, { value: 0 })
      ).to.be.revertedWith("Must send HBAR to buy tokens");
    });

    it("Should handle very large amounts", async function () {
      const largeAmount = ethers.parseEther("1000.0");
      
      await expect(
        market.connect(user1).buyTokens(true, largeAmount, { value: largeAmount })
      ).to.emit(market, "TokensPurchased");
    });

    it("Should maintain correct accounting with multiple purchases", async function () {
      const amount1 = ethers.parseEther("1.0");
      const amount2 = ethers.parseEther("2.0");
      const amount3 = ethers.parseEther("0.5");

      await market.connect(user1).buyTokens(true, amount1, { value: amount1 });
      await market.connect(user1).buyTokens(true, amount2, { value: amount2 });
      await market.connect(user2).buyTokens(false, amount3, { value: amount3 });

      const user1Shares = await market.yesShares(user1.address);
      const user2Shares = await market.noShares(user2.address);
      
      expect(user1Shares).to.equal(amount1 + amount2);
      expect(user2Shares).to.equal(amount3);

      const marketInfo = await market.marketInfo();
      expect(marketInfo.totalYesShares).to.equal(amount1 + amount2);
      expect(marketInfo.totalNoShares).to.equal(amount3);
      expect(marketInfo.totalCollateral).to.equal(amount1 + amount2 + amount3);
    });
  });
});