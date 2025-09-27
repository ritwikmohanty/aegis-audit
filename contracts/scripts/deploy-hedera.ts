import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
}

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying contracts to Hedera Testnet...");
  console.log("Deployer account:", deployer.account.address);
  console.log("Network:", network.name);

  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });
  console.log("Account balance:", formatEther(balance));

  if (balance < parseEther("1")) {
    console.warn("⚠️  Low balance detected. Consider adding more HBAR to your account.");
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
  };

  try {
    // 1. Deploy MarketTokens contract
    console.log("\n1. Deploying MarketTokens contract...");
    const marketTokens = await viem.deployContract("MarketTokens", [deployer.account.address]);
    const marketTokensReceipt = await publicClient.waitForTransactionReceipt({ 
      hash: marketTokens.hash 
    });
    
    deploymentInfo.contracts.marketTokens = marketTokens.address;
    deploymentInfo.gasUsed.marketTokens = marketTokensReceipt.gasUsed.toString();
    
    console.log("✅ MarketTokens deployed to:", marketTokens.address);
    console.log("   Gas used:", marketTokensReceipt.gasUsed.toString());

    // 2. Deploy PredictionMarket contract
    console.log("\n2. Deploying PredictionMarket contract...");
    const predictionMarket = await viem.deployContract("PredictionMarket", [marketTokens.address]);
    const predictionMarketReceipt = await publicClient.waitForTransactionReceipt({ 
      hash: predictionMarket.hash 
    });
    
    deploymentInfo.contracts.predictionMarket = predictionMarket.address;
    deploymentInfo.gasUsed.predictionMarket = predictionMarketReceipt.gasUsed.toString();
    
    console.log("✅ PredictionMarket deployed to:", predictionMarket.address);
    console.log("   Gas used:", predictionMarketReceipt.gasUsed.toString());

    // 3. Set the correct PredictionMarket address in the MarketTokens contract
    console.log("\n3. Updating MarketTokens with PredictionMarket address...");
    const setPredictionMarketHash = await marketTokens.write.setPredictionMarket([predictionMarket.address]);
    const setPredictionMarketReceipt = await publicClient.waitForTransactionReceipt({ 
      hash: setPredictionMarketHash 
    });
    
    deploymentInfo.gasUsed.setPredictionMarket = setPredictionMarketReceipt.gasUsed.toString();
    
    console.log("✅ MarketTokens `predictionMarket` address updated");
    console.log("   Gas used:", setPredictionMarketReceipt.gasUsed.toString());

    // 4. Save deployment information
    const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
    const deploymentDir = path.dirname(deploymentPath);
    
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n📄 Deployment info saved to:", deploymentPath);

    // 5. Create environment file for frontend
    const envContent = `# Contract addresses for ${network.name}
NEXT_PUBLIC_PREDICTION_MARKET_CONTRACT_ADDRESS=${predictionMarket.address}
NEXT_PUBLIC_MARKET_TOKENS_CONTRACT_ADDRESS=${marketTokens.address}
NEXT_PUBLIC_NETWORK=${network.name}
NEXT_PUBLIC_HEDERA_TESTNET_RPC_URL=${process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api"}
`;
    
    const frontendEnvPath = path.join(__dirname, "..", "..", "frontend", ".env.local");
    fs.writeFileSync(frontendEnvPath, envContent);
    console.log("📄 Frontend environment file created:", frontendEnvPath);

    // 6. Display summary
    console.log("\n🎉 Deployment Summary:");
    console.log("====================");
    console.log("Network:", network.name);
    console.log("Deployer:", deployer.account.address);
    console.log("MarketTokens:", marketTokens.address);
    console.log("PredictionMarket:", predictionMarket.address);
    console.log("Total gas used:", (
      BigInt(marketTokensReceipt.gasUsed) + 
      BigInt(predictionMarketReceipt.gasUsed) + 
      BigInt(setPredictionMarketReceipt.gasUsed)
    ).toString());

    console.log("\n📋 Next Steps:");
    console.log("1. Copy the contract addresses to your frontend .env.local file");
    console.log("2. Verify contracts on Hashscan:");
    console.log(`   - MarketTokens: https://hashscan.io/testnet/contract/${marketTokens.address}`);
    console.log(`   - PredictionMarket: https://hashscan.io/testnet/contract/${predictionMarket.address}`);
    console.log("3. Test the contracts with the frontend application");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
