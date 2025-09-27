const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MarketFactory Contract", function () {
  let marketFactory, marketTokens;
  let owner, oracle, user1, user2;
  const QUESTION1 = "Will HBAR reach $0.10 by end of 2024?";
  const QUESTION2 = "Will Bitcoin reach $100k by end of 2024?";
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
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await marketFactory.owner()).to.equal(owner.address);
    });

    it("Should set the correct market token manager", async function () {
      expect(await marketFactory.marketTokenManager()).to.equal(await marketTokens.getAddress());
    });

    it("Should start with zero markets", async function () {
      expect(await marketFactory.getMarketCount()).to.equal(0);
    });
  });

  describe("Market Creation", function () {
    it("Should create a new market successfully", async function () {
      const endTime = (await time.latest()) + 86400; // 24 hours from now
      
      await expect(marketFactory.connect(user1).createMarket(
        QUESTION1,
        endTime,
        oracle.address,
        YES_SYMBOL,
        NO_SYMBOL
      ))
        .to.emit(marketFactory, "MarketCreated")
        .withArgs(0, anyValue, QUESTION1, oracle.address, anyValue, anyValue);

      expect(await marketFactory.getMarketCount()).to.equal(1);
      
      const marketAddress = await marketFactory.getMarketAddress(0);
      expect(marketAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should create multiple markets with correct IDs", async function () {
      const endTime1 = (await time.latest()) + 86400;
      const endTime2 = (await time.latest()) + 172800;

      await marketFactory.connect(user1).createMarket(
        QUESTION1,
        endTime1,
        oracle.address,
        YES_SYMBOL,
        NO_SYMBOL
      );

      await marketFactory.connect(user2).createMarket(
        QUESTION2,
        endTime2,
        oracle.address,
        "YES_BTC",
        "NO_BTC"
      );

      expect(await marketFactory.getMarketCount()).to.equal(2);
      
      const marketAddress1 = await marketFactory.getMarketAddress(0);
      const marketAddress2 = await marketFactory.getMarketAddress(1);
      
      expect(marketAddress1).to.not.equal(marketAddress2);
      expect(marketAddress1).to.not.equal(ethers.ZeroAddress);
      expect(marketAddress2).to.not.equal(ethers.ZeroAddress);
    });

    it("Should create markets with correct token addresses", async function () {
      const endTime = (await time.latest()) + 86400;
      
      await marketFactory.connect(user1).createMarket(
        QUESTION1,
        endTime,
        oracle.address,
        YES_SYMBOL,
        NO_SYMBOL
      );

      const marketAddress = await marketFactory.getMarketAddress(0);
      const market = await ethers.getContractAt("Market", marketAddress);
      const marketInfo = await market.marketInfo();

      expect(marketInfo.yesTokenAddress).to.not.equal(ethers.ZeroAddress);
      expect(marketInfo.noTokenAddress).to.not.equal(ethers.ZeroAddress);
      expect(marketInfo.yesTokenAddress).to.not.equal(marketInfo.noTokenAddress);
    });

    it("Should set correct market parameters", async function () {
      const endTime = (await time.latest()) + 86400;
      
      await marketFactory.connect(user1).createMarket(
        QUESTION1,
        endTime,
        oracle.address,
        YES_SYMBOL,
        NO_SYMBOL
      );

      const marketAddress = await marketFactory.getMarketAddress(0);
      const market = await ethers.getContractAt("Market", marketAddress);
      const marketInfo = await market.marketInfo();

      expect(marketInfo.question).to.equal(QUESTION1);
      expect(marketInfo.endTime).to.equal(endTime);
      expect(marketInfo.oracle).to.equal(oracle.address);
      expect(marketInfo.totalYesShares).to.equal(0);
      expect(marketInfo.totalNoShares).to.equal(0);
      expect(marketInfo.totalCollateral).to.equal(0);
      expect(marketInfo.isResolved).to.be.false;
    });

    it("Should set factory as owner of created markets", async function () {
      const endTime = (await time.latest()) + 86400;
      
      await marketFactory.connect(user1).createMarket(
        QUESTION1,
        endTime,
        oracle.address,
        YES_SYMBOL,
        NO_SYMBOL
      );

      const marketAddress = await marketFactory.getMarketAddress(0);
      const market = await ethers.getContractAt("Market", marketAddress);

      expect(await market.owner()).to.equal(await marketFactory.getAddress());
    });

    it("Should allow anyone to create markets", async function () {
      const endTime = (await time.latest()) + 86400;
      
      await expect(
        marketFactory.connect(user1).createMarket(
          QUESTION1,
          endTime,
          oracle.address,
          YES_SYMBOL,
          NO_SYMBOL
        )
      ).to.not.be.reverted;

      await expect(
        marketFactory.connect(user2).createMarket(
          QUESTION2,
          endTime,
          oracle.address,
          "YES_BTC",
          "NO_BTC"
        )
      ).to.not.be.reverted;

      expect(await marketFactory.getMarketCount()).to.equal(2);
    });

    it("Should handle empty question", async function () {
      const endTime = (await time.latest()) + 86400;
      
      await expect(
        marketFactory.connect(user1).createMarket(
          "",
          endTime,
          oracle.address,
          YES_SYMBOL,
          NO_SYMBOL
        )
      ).to.not.be.reverted; // Empty question is allowed, just not recommended
    });

    it("Should handle zero oracle address", async function () {
      const endTime = (await time.latest()) + 86400;
      
      await expect(
        marketFactory.connect(user1).createMarket(
          QUESTION1,
          endTime,
          ethers.ZeroAddress,
          YES_SYMBOL,
          NO_SYMBOL
        )
      ).to.not.be.reverted; // Zero oracle is allowed but not recommended
    });
  });

  describe("Market Retrieval", function () {
    beforeEach(async function () {
      const endTime1 = (await time.latest()) + 86400;
      const endTime2 = (await time.latest()) + 172800;

      await marketFactory.connect(user1).createMarket(
        QUESTION1,
        endTime1,
        oracle.address,
        YES_SYMBOL,
        NO_SYMBOL
      );

      await marketFactory.connect(user2).createMarket(
        QUESTION2,
        endTime2,
        oracle.address,
        "YES_BTC",
        "NO_BTC"
      );
    });

    it("Should return correct market count", async function () {
      expect(await marketFactory.getMarketCount()).to.equal(2);
    });

    it("Should return correct market addresses", async function () {
      const marketAddress1 = await marketFactory.getMarketAddress(0);
      const marketAddress2 = await marketFactory.getMarketAddress(1);
      
      expect(marketAddress1).to.not.equal(ethers.ZeroAddress);
      expect(marketAddress2).to.not.equal(ethers.ZeroAddress);
      expect(marketAddress1).to.not.equal(marketAddress2);
    });

    it("Should revert when accessing non-existent market", async function () {
      await expect(
        marketFactory.getMarketAddress(2)
      ).to.be.revertedWith("Market ID out of bounds");

      await expect(
        marketFactory.getMarketAddress(999)
      ).to.be.revertedWith("Market ID out of bounds");
    });

    it("Should return markets in creation order", async function () {
      const marketAddress1 = await marketFactory.getMarketAddress(0);
      const marketAddress2 = await marketFactory.getMarketAddress(1);
      
      const market1 = await ethers.getContractAt("Market", marketAddress1);
      const market2 = await ethers.getContractAt("Market", marketAddress2);
      
      const marketInfo1 = await market1.marketInfo();
      const marketInfo2 = await market2.marketInfo();
      
      expect(marketInfo1.question).to.equal(QUESTION1);
      expect(marketInfo2.question).to.equal(QUESTION2);
    });
  });

  describe("Integration with MarketTokens", function () {
    it("Should create unique token addresses for each market", async function () {
      const endTime1 = (await time.latest()) + 86400;
      const endTime2 = (await time.latest()) + 172800;

      await marketFactory.connect(user1).createMarket(
        QUESTION1,
        endTime1,
        oracle.address,
        YES_SYMBOL,
        NO_SYMBOL
      );

      await marketFactory.connect(user2).createMarket(
        QUESTION2,
        endTime2,
        oracle.address,
        "YES_BTC",
        "NO_BTC"
      );

      const marketAddress1 = await marketFactory.getMarketAddress(0);
      const marketAddress2 = await marketFactory.getMarketAddress(1);
      
      const market1 = await ethers.getContractAt("Market", marketAddress1);
      const market2 = await ethers.getContractAt("Market", marketAddress2);
      
      const marketInfo1 = await market1.marketInfo();
      const marketInfo2 = await market2.marketInfo();
      
      // Token addresses should be unique across markets
      expect(marketInfo1.yesTokenAddress).to.not.equal(marketInfo2.yesTokenAddress);
      expect(marketInfo1.noTokenAddress).to.not.equal(marketInfo2.noTokenAddress);
      expect(marketInfo1.yesTokenAddress).to.not.equal(marketInfo1.noTokenAddress);
      expect(marketInfo2.yesTokenAddress).to.not.equal(marketInfo2.noTokenAddress);
    });

    it("Should handle token creation failures gracefully", async function () {
      // This test would require mocking the MarketTokens contract to fail
      // For now, we'll just ensure the factory doesn't crash on valid inputs
      const endTime = (await time.latest()) + 86400;
      
      await expect(
        marketFactory.connect(user1).createMarket(
          QUESTION1,
          endTime,
          oracle.address,
          YES_SYMBOL,
          NO_SYMBOL
        )
      ).to.not.be.reverted;
    });
  });

  describe("Gas Optimization", function () {
    it("Should create markets efficiently", async function () {
      const endTime = (await time.latest()) + 86400;
      
      const tx = await marketFactory.connect(user1).createMarket(
        QUESTION1,
        endTime,
        oracle.address,
        YES_SYMBOL,
        NO_SYMBOL
      );
      
      const receipt = await tx.wait();
      // Gas usage should be reasonable (this is more of a sanity check)
      expect(receipt.gasUsed).to.be.lt(ethers.parseUnits("5000000", 0)); // 5M gas
    });

    it("Should handle batch market creation", async function () {
      const endTime = (await time.latest()) + 86400;
      
      // Create multiple markets in sequence
      for (let i = 0; i < 5; i++) {
        await marketFactory.connect(user1).createMarket(
          `Question ${i}`,
          endTime + i * 3600,
          oracle.address,
          `YES_${i}`,
          `NO_${i}`
        );
      }
      
      expect(await marketFactory.getMarketCount()).to.equal(5);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very long questions", async function () {
      const longQuestion = "A".repeat(1000); // Very long question
      const endTime = (await time.latest()) + 86400;
      
      await expect(
        marketFactory.connect(user1).createMarket(
          longQuestion,
          endTime,
          oracle.address,
          YES_SYMBOL,
          NO_SYMBOL
        )
      ).to.not.be.reverted;
    });

    it("Should handle very long symbols", async function () {
      const longSymbol = "A".repeat(100); // Very long symbol
      const endTime = (await time.latest()) + 86400;
      
      await expect(
        marketFactory.connect(user1).createMarket(
          QUESTION1,
          endTime,
          oracle.address,
          longSymbol,
          longSymbol
        )
      ).to.not.be.reverted;
    });

    it("Should handle past end times", async function () {
      const pastTime = (await time.latest()) - 86400; // 24 hours ago
      
      await expect(
        marketFactory.connect(user1).createMarket(
          QUESTION1,
          pastTime,
          oracle.address,
          YES_SYMBOL,
          NO_SYMBOL
        )
      ).to.not.be.reverted; // Past times are allowed, market logic will handle it
    });
  });
});
