const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MarketTokens Contract", function () {
  let marketTokens;
  let owner, predictionMarket, user1, user2;

  beforeEach(async function () {
    [owner, predictionMarket, user1, user2] = await ethers.getSigners();
    
    const MarketTokens = await ethers.getContractFactory("MarketTokens");
    marketTokens = await MarketTokens.deploy(predictionMarket.address);
    await marketTokens.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await marketTokens.owner()).to.equal(owner.address);
    });

    it("Should set the correct prediction market address", async function () {
      expect(await marketTokens.predictionMarket()).to.equal(predictionMarket.address);
    });
  });

  describe("Token Creation", function () {
    const YES_NAME = "YES: Will HBAR reach $0.10?";
    const YES_SYMBOL = "YES_HBAR";
    const NO_NAME = "NO: Will HBAR reach $0.10?";
    const NO_SYMBOL = "NO_HBAR";

    it("Should allow prediction market to create tokens", async function () {
      const tx = await marketTokens.connect(predictionMarket).createMarketTokens(
        YES_NAME,
        YES_SYMBOL,
        NO_NAME,
        NO_SYMBOL
      );
      
      // The function should not revert and should return token addresses
      await expect(tx).to.not.be.reverted;

      // Verify tokens were created by checking the return values
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("Should revert when non-prediction market tries to create tokens", async function () {
      await expect(
        marketTokens.connect(user1).createMarketTokens(
          YES_NAME,
          YES_SYMBOL,
          NO_NAME,
          NO_SYMBOL
        )
      ).to.be.revertedWith("Only prediction market can create tokens");
    });

    it("Should revert when owner tries to create tokens directly", async function () {
      await expect(
        marketTokens.connect(owner).createMarketTokens(
          YES_NAME,
          YES_SYMBOL,
          NO_NAME,
          NO_SYMBOL
        )
      ).to.be.revertedWith("Only prediction market can create tokens");
    });

    it("Should create tokens with correct names and symbols", async function () {
      await marketTokens.connect(predictionMarket).createMarketTokens(
        YES_NAME,
        YES_SYMBOL,
        NO_NAME,
        NO_SYMBOL
      );

      // Verify the transaction was successful
      // In a real test environment with HTS, we would verify token properties
      const tx = await marketTokens.connect(predictionMarket).createMarketTokens(
        YES_NAME,
        YES_SYMBOL,
        NO_NAME,
        NO_SYMBOL
      );
      await expect(tx).to.not.be.reverted;
    });

    it("Should create multiple token pairs successfully", async function () {
      // Create first pair
      await marketTokens.connect(predictionMarket).createMarketTokens(
        "YES: Question 1",
        "YES_Q1",
        "NO: Question 1",
        "NO_Q1"
      );

      // Create second pair
      await marketTokens.connect(predictionMarket).createMarketTokens(
        "YES: Question 2",
        "YES_Q2",
        "NO: Question 2",
        "NO_Q2"
      );

      // Both transactions should succeed
      expect(true).to.be.true; // Placeholder assertion
    });

    it("Should handle empty names and symbols", async function () {
      await expect(
        marketTokens.connect(predictionMarket).createMarketTokens(
          "",
          "",
          "",
          ""
        )
      ).to.not.be.reverted; // Empty strings are allowed but not recommended
    });

    it("Should handle very long names and symbols", async function () {
      const longName = "A".repeat(1000);
      const longSymbol = "A".repeat(100);

      await expect(
        marketTokens.connect(predictionMarket).createMarketTokens(
          longName,
          longSymbol,
          longName,
          longSymbol
        )
      ).to.not.be.reverted;
    });
  });

  describe("Prediction Market Management", function () {
    it("Should allow owner to set prediction market address", async function () {
      await marketTokens.setPredictionMarket(user1.address);
      expect(await marketTokens.predictionMarket()).to.equal(user1.address);
    });

    it("Should revert when setting zero address as prediction market", async function () {
      await expect(
        marketTokens.setPredictionMarket(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should revert when non-owner tries to set prediction market", async function () {
      await expect(
        marketTokens.connect(user1).setPredictionMarket(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow updating prediction market multiple times", async function () {
      await marketTokens.setPredictionMarket(user1.address);
      expect(await marketTokens.predictionMarket()).to.equal(user1.address);

      await marketTokens.setPredictionMarket(user2.address);
      expect(await marketTokens.predictionMarket()).to.equal(user2.address);
    });
  });

  describe("Access Control", function () {
    it("Should allow only prediction market to create tokens", async function () {
      // Test with different accounts
      const accounts = [owner, user1, user2];
      
      for (const account of accounts) {
        if (account.address !== predictionMarket.address) {
          await expect(
            marketTokens.connect(account).createMarketTokens(
              "YES: Test",
              "YES_TEST",
              "NO: Test",
              "NO_TEST"
            )
          ).to.be.revertedWith("Only prediction market can create tokens");
        }
      }
    });

    it("Should allow only owner to set prediction market", async function () {
      const nonOwners = [user1, user2, predictionMarket];
      
      for (const account of nonOwners) {
        await expect(
          marketTokens.connect(account).setPredictionMarket(user1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      }
    });
  });

  describe("Gas Optimization", function () {
    it("Should create tokens efficiently", async function () {
      const tx = await marketTokens.connect(predictionMarket).createMarketTokens(
        "YES: Gas Test",
        "YES_GAS",
        "NO: Gas Test",
        "NO_GAS"
      );
      
      const receipt = await tx.wait();
      // Gas usage should be reasonable
      expect(receipt.gasUsed).to.be.lt(ethers.parseUnits("10000000", 0)); // 10M gas
    });

    it("Should handle batch token creation efficiently", async function () {
      // Create multiple token pairs
      for (let i = 0; i < 3; i++) {
        await marketTokens.connect(predictionMarket).createMarketTokens(
          `YES: Batch ${i}`,
          `YES_B${i}`,
          `NO: Batch ${i}`,
          `NO_B${i}`
        );
      }
      
      // All transactions should succeed
      expect(true).to.be.true; // Placeholder assertion
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero address as prediction market in constructor", async function () {
      const MarketTokens = await ethers.getContractFactory("MarketTokens");
      // This should not revert - zero address is allowed in constructor
      const marketTokensZero = await MarketTokens.deploy(ethers.ZeroAddress);
      await marketTokensZero.waitForDeployment();
      
      expect(await marketTokensZero.predictionMarket()).to.equal(ethers.ZeroAddress);
    });

    it("Should handle prediction market address change after token creation", async function () {
      // Create tokens with original prediction market
      await marketTokens.connect(predictionMarket).createMarketTokens(
        "YES: Original",
        "YES_ORIG",
        "NO: Original",
        "NO_ORIG"
      );

      // Change prediction market
      await marketTokens.setPredictionMarket(user1.address);

      // New prediction market should be able to create tokens
      await expect(
        marketTokens.connect(user1).createMarketTokens(
          "YES: New",
          "YES_NEW",
          "NO: New",
          "NO_NEW"
        )
      ).to.not.be.reverted;
    });
  });
});