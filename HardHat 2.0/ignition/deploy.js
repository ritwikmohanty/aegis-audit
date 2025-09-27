import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables from .env file
dotenv.config();

async function main() {
  console.log("🚀 Starting Hedera Testnet Deployment...");

  // Get ethers from the Hardhat Runtime Environment
  const { ethers } = hre;

  // --- 1. Set up connection to Hedera Testnet ---
  const provider = new ethers.JsonRpcProvider(process.env.HEDERA_TESTNET_RPC_URL);
  
  const privateKey = process.env.HEDERA_TESTNET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("❌ HEDERA_TESTNET_PRIVATE_KEY is not set in the .env file. Please add it.");
  }

  // The 'deployer' is a wallet instance that can sign transactions
  const deployer = new ethers.Wallet(privateKey, provider);
  
  console.log("\n📋 Deployment Details:");
  console.log("Network: Hedera Testnet");
  console.log("Deploying with account:", deployer.address);

  const balance = await provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HBAR");
  
  if (balance < ethers.parseEther("1")) {
    console.warn("⚠️  Warning: Account balance is low. Consider adding more HBAR for deployment.");
  }

  const deploymentInfo = {
    network: "hedera_testnet",
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  try {
    // --- 2. Deploy MarketTokens contract ---
    console.log("\n📦 Deploying MarketTokens contract...");
    const MarketTokens = await ethers.getContractFactory("MarketTokens", deployer);
    const marketTokens = await MarketTokens.deploy(deployer.address, {
      gasPrice: ethers.parseUnits("420", "gwei") // Set gas price to meet minimum requirement
    });
    await marketTokens.waitForDeployment();
    
    const marketTokensAddress = await marketTokens.getAddress();
    console.log("✅ MarketTokens deployed to:", marketTokensAddress);
    deploymentInfo.contracts.MarketTokens = marketTokensAddress;

    // --- 3. Deploy MarketFactory contract ---
    console.log("\n📦 Deploying MarketFactory contract...");
    const MarketFactory = await ethers.getContractFactory("MarketFactory", deployer);
    const marketFactory = await MarketFactory.deploy(marketTokensAddress, {
      gasPrice: ethers.parseUnits("420", "gwei")
    });
    await marketFactory.waitForDeployment();
    
    const marketFactoryAddress = await marketFactory.getAddress();
    console.log("✅ MarketFactory deployed to:", marketFactoryAddress);
    deploymentInfo.contracts.MarketFactory = marketFactoryAddress;

    // --- 4. Set the prediction market address in MarketTokens ---
    console.log("\n🔗 Setting prediction market address...");
    await marketTokens.setPredictionMarket(marketFactoryAddress, {
      gasPrice: ethers.parseUnits("420", "gwei")
    });
    console.log("✅ Prediction market address set");

    // --- 5. Deploy AuditTrail contract ---
    console.log("\n📦 Deploying AuditTrail contract...");
    const AuditTrail = await ethers.getContractFactory("AuditTrail", deployer);
    // Use a placeholder topic ID (we'll skip AuditTrail for now since it requires HCS topic setup)
    console.log("⚠️  Skipping AuditTrail deployment - requires HCS topic setup");
    // const auditTrail = await AuditTrail.deploy(deployer.address, ethers.ZeroAddress, {
    //   gasPrice: ethers.parseUnits("420", "gwei")
    // });
    // await auditTrail.waitForDeployment();
    
    // const auditTrailAddress = await auditTrail.getAddress();
    // console.log("✅ AuditTrail deployed to:", auditTrailAddress);
    // deploymentInfo.contracts.AuditTrail = auditTrailAddress;

    // --- 6. Save deployment information ---
    const deploymentPath = path.join(process.cwd(), "deployments", "hedera_testnet.json");
    const deploymentDir = path.dirname(deploymentPath);
    
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to:", deploymentPath);

    // --- 7. Display summary ---
    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Contract Addresses:");
    console.log("MarketTokens:", marketTokensAddress);
    console.log("MarketFactory:", marketFactoryAddress);

    console.log("\n🔗 Hashscan Links:");
    console.log("MarketTokens:", `https://testnet.hashscan.io/contract/${marketTokensAddress}`);
    console.log("MarketFactory:", `https://testnet.hashscan.io/contract/${marketFactoryAddress}`);

    const newBalance = await provider.getBalance(deployer.address);
    console.log("\nFinal account balance:", ethers.formatEther(newBalance), "HBAR");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    
    // Save partial deployment info for debugging
    const errorInfo = {
      ...deploymentInfo,
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(process.cwd(), "deployments", "hedera_testnet_error.json");
    const errorDir = path.dirname(errorPath);
    
    if (!fs.existsSync(errorDir)) {
      fs.mkdirSync(errorDir, { recursive: true });
    }
    
    fs.writeFileSync(errorPath, JSON.stringify(errorInfo, null, 2));
    console.log("Error info saved to:", errorPath);
    
    throw error;
  }
}

main().catch((error) => {
  console.error("\n❌ Operation failed:", error);
  process.exitCode = 1;
});

