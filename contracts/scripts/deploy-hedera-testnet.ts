import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DeploymentInfo {
  network: string;
  timestamp: string;
  deployer: string;
  contracts: {
    marketTokens: string;
    predictionMarket: string;
  };
  gasUsed: {
    marketTokens: string;
    predictionMarket: string;
    setPredictionMarket: string;
  };
  hederaInfo: {
    rpcUrl: string;
    chainId: number;
    accountId: string;
  };
}

async function main() {
  console.log("🚀 Deploying to Hedera Testnet...");
  console.log("=====================================");
  
  // Check environment variables
  const requiredEnvVars = [
    'HEDERA_TESTNET_RPC_URL',
    'HEDERA_TESTNET_PRIVATE_KEY', 
    'HEDERA_TESTNET_ACCOUNT_ID'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log("❌ Missing required environment variables:");
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log("\n📋 Please set up your environment variables:");
    console.log("1. Copy the template: cp env.template .env");
    console.log("2. Edit .env with your Hedera Testnet credentials");
    console.log("3. Get test HBAR from: https://portal.hedera.com/");
    console.log("\nRequired variables:");
    console.log("- HEDERA_TESTNET_RPC_URL=https://testnet.hashio.io/api");
    console.log("- HEDERA_TESTNET_PRIVATE_KEY=your_private_key");
    console.log("- HEDERA_TESTNET_ACCOUNT_ID=0.0.your_account_id");
    process.exit(1);
  }

  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("✅ Environment variables configured");
  console.log("📋 Deployment Configuration:");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.account.address);
  console.log("RPC URL:", process.env.HEDERA_TESTNET_RPC_URL);
  console.log("Account ID:", process.env.HEDERA_TESTNET_ACCOUNT_ID);

  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });
  console.log("Account balance:", formatEther(balance), "HBAR");

  if (balance < parseEther("1")) {
    console.log("⚠️  Low balance detected. Consider adding more test HBAR.");
    console.log("Get test HBAR from: https://portal.hedera.com/");
  }

  const deploymentInfo: DeploymentInfo = {
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.account.address,
    contracts: {
      marketTokens: "",
      predictionMarket: "",
    },
    gasUsed: {
      marketTokens: "",
      predictionMarket: "",
      setPredictionMarket: "",
    },
    hederaInfo: {
      rpcUrl: process.env.HEDERA_TESTNET_RPC_URL || "",
      chainId: 296,
      accountId: process.env.HEDERA_TESTNET_ACCOUNT_ID || "",
    },
  };

  try {
    console.log("\n1️⃣ Deploying MarketTokens contract...");
    const marketTokens = await viem.deployContract("MarketTokens", [deployer.account.address]);
    const marketTokensReceipt = await publicClient.waitForTransactionReceipt({ 
      hash: marketTokens.hash 
    });
    
    deploymentInfo.contracts.marketTokens = marketTokens.address;
    deploymentInfo.gasUsed.marketTokens = marketTokensReceipt.gasUsed.toString();
    
    console.log("✅ MarketTokens deployed to:", marketTokens.address);
    console.log("   Gas used:", marketTokensReceipt.gasUsed.toString());
    console.log("   Transaction hash:", marketTokens.hash);

    console.log("\n2️⃣ Deploying PredictionMarket contract...");
    const predictionMarket = await viem.deployContract("PredictionMarket", [marketTokens.address]);
    const predictionMarketReceipt = await publicClient.waitForTransactionReceipt({ 
      hash: predictionMarket.hash 
    });
    
    deploymentInfo.contracts.predictionMarket = predictionMarket.address;
    deploymentInfo.gasUsed.predictionMarket = predictionMarketReceipt.gasUsed.toString();
    
    console.log("✅ PredictionMarket deployed to:", predictionMarket.address);
    console.log("   Gas used:", predictionMarketReceipt.gasUsed.toString());
    console.log("   Transaction hash:", predictionMarket.hash);

    console.log("\n3️⃣ Linking contracts...");
    const setPredictionMarketHash = await marketTokens.write.setPredictionMarket([predictionMarket.address]);
    const setPredictionMarketReceipt = await publicClient.waitForTransactionReceipt({ 
      hash: setPredictionMarketHash 
    });
    
    deploymentInfo.gasUsed.setPredictionMarket = setPredictionMarketReceipt.gasUsed.toString();
    
    console.log("✅ Contracts linked successfully");
    console.log("   Gas used:", setPredictionMarketReceipt.gasUsed.toString());
    console.log("   Transaction hash:", setPredictionMarketHash);

    // Save deployment information
    const deploymentPath = path.join(__dirname, "..", "deployments", `hederaTestnet.json`);
    const deploymentDir = path.dirname(deploymentPath);
    
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n📄 Deployment info saved to:", deploymentPath);

    // Create environment file for frontend
    const envContent = `# Contract addresses for Hedera Testnet
NEXT_PUBLIC_PREDICTION_MARKET_CONTRACT_ADDRESS=${predictionMarket.address}
NEXT_PUBLIC_MARKET_TOKENS_CONTRACT_ADDRESS=${marketTokens.address}
NEXT_PUBLIC_NETWORK=hederaTestnet
NEXT_PUBLIC_HEDERA_TESTNET_RPC_URL=${process.env.HEDERA_TESTNET_RPC_URL}
NEXT_PUBLIC_HEDERA_TESTNET_ACCOUNT_ID=${process.env.HEDERA_TESTNET_ACCOUNT_ID}
`;
    
    const frontendEnvPath = path.join(__dirname, "..", "..", "frontend", ".env.local");
    fs.writeFileSync(frontendEnvPath, envContent);
    console.log("📄 Frontend environment file created:", frontendEnvPath);

    // Display summary
    console.log("\n🎉 Hedera Testnet Deployment Summary:");
    console.log("=====================================");
    console.log("Network: Hedera Testnet");
    console.log("Deployer:", deployer.account.address);
    console.log("Account ID:", process.env.HEDERA_TESTNET_ACCOUNT_ID);
    console.log("MarketTokens:", marketTokens.address);
    console.log("PredictionMarket:", predictionMarket.address);
    console.log("Total gas used:", (
      BigInt(marketTokensReceipt.gasUsed) + 
      BigInt(predictionMarketReceipt.gasUsed) + 
      BigInt(setPredictionMarketReceipt.gasUsed)
    ).toString());

    console.log("\n🔗 Contract Verification URLs:");
    console.log(`MarketTokens: https://hashscan.io/testnet/contract/${marketTokens.address}`);
    console.log(`PredictionMarket: https://hashscan.io/testnet/contract/${predictionMarket.address}`);

    console.log("\n📋 Next Steps:");
    console.log("1. Verify contracts on Hashscan (optional)");
    console.log("2. Test the contracts with: npm run test:hedera");
    console.log("3. Start frontend: cd ../frontend && npm run dev");
    console.log("4. Test the complete user interface");

    console.log("\n✅ Deployment to Hedera Testnet completed successfully!");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});