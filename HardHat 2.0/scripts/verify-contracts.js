const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Starting contract verification on Hashscan...");

  // Load deployment info
  const deploymentPath = path.join(__dirname, "..", "deployments", "hedera_testnet.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No deployment file found. Please deploy contracts first.");
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("📋 Found deployment info for:", deploymentInfo.network);

  const contracts = deploymentInfo.contracts;
  
  try {
    // Verify MarketTokens contract
    if (contracts.MarketTokens) {
      console.log("\n🔍 Verifying MarketTokens contract...");
      try {
        await hre.run("verify:verify", {
          address: contracts.MarketTokens,
          constructorArguments: [deploymentInfo.deployer],
          network: "hedera_testnet"
        });
        console.log("✅ MarketTokens verified successfully");
      } catch (error) {
        console.log("⚠️  MarketTokens verification failed:", error.message);
      }
    }

    // Verify MarketFactory contract
    if (contracts.MarketFactory && contracts.MarketTokens) {
      console.log("\n🔍 Verifying MarketFactory contract...");
      try {
        await hre.run("verify:verify", {
          address: contracts.MarketFactory,
          constructorArguments: [contracts.MarketTokens],
          network: "hedera_testnet"
        });
        console.log("✅ MarketFactory verified successfully");
      } catch (error) {
        console.log("⚠️  MarketFactory verification failed:", error.message);
      }
    }

    // Verify AuditTrail contract
    if (contracts.AuditTrail) {
      console.log("\n🔍 Verifying AuditTrail contract...");
      try {
        await hre.run("verify:verify", {
          address: contracts.AuditTrail,
          constructorArguments: [deploymentInfo.deployer, "0x0000000000000000000000000000000000000000"],
          network: "hedera_testnet"
        });
        console.log("✅ AuditTrail verified successfully");
      } catch (error) {
        console.log("⚠️  AuditTrail verification failed:", error.message);
      }
    }

    // Display Hashscan links
    console.log("\n🔗 Hashscan Links:");
    Object.entries(contracts).forEach(([name, address]) => {
      console.log(`${name}: https://testnet.hashscan.io/contract/${address}`);
    });

    console.log("\n🎉 Verification process completed!");

  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
