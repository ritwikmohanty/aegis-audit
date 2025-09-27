const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Hedera Testnet Deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
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
    // 1. Deploy MarketTokens contract
    console.log("\n📦 Deploying MarketTokens contract...");
    const MarketTokens = await ethers.getContractFactory("MarketTokens");
    const marketTokens = await MarketTokens.deploy(deployer.address);
    await marketTokens.waitForDeployment();
    
    const marketTokensAddress = await marketTokens.getAddress();
    console.log("✅ MarketTokens deployed to:", marketTokensAddress);
    deploymentInfo.contracts.MarketTokens = marketTokensAddress;

    // 2. Deploy MarketFactory contract
    console.log("\n📦 Deploying MarketFactory contract...");
    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const marketFactory = await MarketFactory.deploy(marketTokensAddress);
    await marketFactory.waitForDeployment();
    
    const marketFactoryAddress = await marketFactory.getAddress();
    console.log("✅ MarketFactory deployed to:", marketFactoryAddress);
    deploymentInfo.contracts.MarketFactory = marketFactoryAddress;

    // 3. Set the prediction market address in MarketTokens
    console.log("\n🔗 Setting prediction market address...");
    await marketTokens.setPredictionMarket(marketFactoryAddress);
    console.log("✅ Prediction market address set");

    // 4. Deploy AuditTrail contract (for HCS integration)
    console.log("\n📦 Deploying AuditTrail contract...");
    const AuditTrail = await ethers.getContractFactory("AuditTrail");
    
    // For now, use a placeholder topic ID (0x0)
    // In a real deployment, you would create an HCS topic first
    const auditTrail = await AuditTrail.deploy(deployer.address, ethers.ZeroAddress);
    await auditTrail.waitForDeployment();
    
    const auditTrailAddress = await auditTrail.getAddress();
    console.log("✅ AuditTrail deployed to:", auditTrailAddress);
    deploymentInfo.contracts.AuditTrail = auditTrailAddress;

    // 5. Test the deployment by creating a sample market
    console.log("\n🧪 Testing deployment with sample market creation...");
    const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
    const sampleOracle = deployer.address; // Using deployer as oracle for testing
    
    const tx = await marketFactory.createMarket(
      "Will HBAR reach $0.10 by end of 2024?",
      endTime,
      sampleOracle,
      "YES_HBAR",
      "NO_HBAR"
    );
    await tx.wait();
    
    const marketAddress = await marketFactory.getMarketAddress(0);
    console.log("✅ Sample market created at:", marketAddress);
    deploymentInfo.contracts.SampleMarket = marketAddress;

    // 6. Save deployment information
    const deploymentPath = path.join(__dirname, "..", "deployments", "hedera_testnet.json");
    const deploymentDir = path.dirname(deploymentPath);
    
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to:", deploymentPath);

    // 7. Display summary
    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Contract Addresses:");
    console.log("MarketTokens:", marketTokensAddress);
    console.log("MarketFactory:", marketFactoryAddress);
    console.log("AuditTrail:", auditTrailAddress);
    console.log("Sample Market:", marketAddress);

    console.log("\n🔗 Hashscan Links:");
    console.log("MarketTokens:", `https://testnet.hashscan.io/contract/${marketTokensAddress}`);
    console.log("MarketFactory:", `https://testnet.hashscan.io/contract/${marketFactoryAddress}`);
    console.log("AuditTrail:", `https://testnet.hashscan.io/contract/${auditTrailAddress}`);
    console.log("Sample Market:", `https://testnet.hashscan.io/contract/${marketAddress}`);

    // 8. Verify contracts (optional)
    console.log("\n🔍 To verify contracts on Hashscan, run:");
    console.log(`npx hardhat verify --network hedera_testnet ${marketTokensAddress} "${deployer.address}"`);
    console.log(`npx hardhat verify --network hedera_testnet ${marketFactoryAddress} "${marketTokensAddress}"`);
    console.log(`npx hardhat verify --network hedera_testnet ${auditTrailAddress} "${deployer.address}" "${ethers.ZeroAddress}"`);

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    
    // Save partial deployment info for debugging
    const errorInfo = {
      ...deploymentInfo,
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, "..", "deployments", "hedera_testnet_error.json");
    fs.writeFileSync(errorPath, JSON.stringify(errorInfo, null, 2));
    console.log("Error info saved to:", errorPath);
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
