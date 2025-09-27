import { network } from "hardhat";
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

interface VerificationResult {
  contract: string;
  address: string;
  verified: boolean;
  error?: string;
  hashscanUrl: string;
}

async function verifyContract(
  contractName: string,
  contractAddress: string,
  constructorArgs: any[] = []
): Promise<VerificationResult> {
  const hashscanUrl = `https://hashscan.io/testnet/contract/${contractAddress}`;
  
  try {
    console.log(`\n🔍 Verifying ${contractName} at ${contractAddress}...`);
    
    // For Hedera, we'll use the hardhat verify plugin
    // Note: This requires the contracts to be deployed and the network to be configured
    await network.run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArgs,
    });
    
    console.log(`✅ ${contractName} verified successfully!`);
    return {
      contract: contractName,
      address: contractAddress,
      verified: true,
      hashscanUrl,
    };
  } catch (error: any) {
    console.log(`❌ Failed to verify ${contractName}:`, error.message);
    return {
      contract: contractName,
      address: contractAddress,
      verified: false,
      error: error.message,
      hashscanUrl,
    };
  }
}

async function main() {
  console.log("🔍 Starting contract verification on Hashscan...");
  console.log("Network:", network.name);

  // Load deployment information
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deployment file not found:", deploymentPath);
    console.log("Please run the deployment script first.");
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("📄 Loaded deployment info from:", deploymentPath);

  const results: VerificationResult[] = [];

  try {
    // Verify MarketTokens contract
    // Constructor args: [predictionMarketAddress] - but we need the deployer address initially
    const marketTokensResult = await verifyContract(
      "MarketTokens",
      deploymentInfo.contracts.marketTokens,
      [deploymentInfo.deployer] // Initial deployer address
    );
    results.push(marketTokensResult);

    // Verify PredictionMarket contract
    // Constructor args: [marketTokensAddress]
    const predictionMarketResult = await verifyContract(
      "PredictionMarket",
      deploymentInfo.contracts.predictionMarket,
      [deploymentInfo.contracts.marketTokens]
    );
    results.push(predictionMarketResult);

    // Save verification results
    const verificationPath = path.join(__dirname, "..", "deployments", `${network.name}-verification.json`);
    fs.writeFileSync(verificationPath, JSON.stringify(results, null, 2));
    console.log("\n📄 Verification results saved to:", verificationPath);

    // Display summary
    console.log("\n🎉 Verification Summary:");
    console.log("=======================");
    
    results.forEach(result => {
      const status = result.verified ? "✅ VERIFIED" : "❌ FAILED";
      console.log(`${status} ${result.contract}: ${result.address}`);
      console.log(`   Hashscan: ${result.hashscanUrl}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    const verifiedCount = results.filter(r => r.verified).length;
    const totalCount = results.length;
    
    console.log(`\n📊 Results: ${verifiedCount}/${totalCount} contracts verified`);
    
    if (verifiedCount === totalCount) {
      console.log("🎉 All contracts verified successfully!");
    } else {
      console.log("⚠️  Some contracts failed verification. Check the errors above.");
    }

  } catch (error) {
    console.error("❌ Verification process failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
