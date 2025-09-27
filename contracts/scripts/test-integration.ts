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

interface TestResult {
  step: string;
  success: boolean;
  gasUsed?: string;
  error?: string;
  data?: any;
  contractAddress?: string;
}

async function main() {
  console.log("🧪 Starting Integration Test...");
  console.log("This test demonstrates the complete prediction market functionality");
  
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2, oracle] = await viem.getWalletClients();

  console.log("\n📋 Test Configuration:");
  console.log("Network:", network.name);
  console.log("Deployer (Owner):", deployer.account.address);
  console.log("User 1 (Bettor):", user1.account.address);
  console.log("User 2 (Bettor):", user2.account.address);
  console.log("Oracle:", oracle.account.address);

  const testResults: TestResult[] = [];

  try {
    // Load deployment information
    const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
    
    if (!fs.existsSync(deploymentPath)) {
      console.log("⚠️  No deployment file found. Running deployment first...");
      
      // Deploy contracts
      console.log("\n1️⃣ Deploying contracts...");
      const marketTokens = await viem.deployContract("MarketTokens", [deployer.account.address]);
      const marketTokensReceipt = await publicClient.waitForTransactionReceipt({ hash: marketTokens.hash });
      
      const predictionMarket = await viem.deployContract("PredictionMarket", [marketTokens.address]);
      const predictionMarketReceipt = await publicClient.waitForTransactionReceipt({ hash: predictionMarket.hash });
      
      const setPredictionMarketHash = await marketTokens.write.setPredictionMarket([predictionMarket.address]);
      const setPredictionMarketReceipt = await publicClient.waitForTransactionReceipt({ hash: setPredictionMarketHash });
      
      const deploymentInfo: DeploymentInfo = {
        network: network.name,
        timestamp: new Date().toISOString(),
        deployer: deployer.account.address,
        contracts: {
          marketTokens: marketTokens.address,
          predictionMarket: predictionMarket.address,
        },
        gasUsed: {
          marketTokens: marketTokensReceipt.gasUsed.toString(),
          predictionMarket: predictionMarketReceipt.gasUsed.toString(),
          setPredictionMarket: setPredictionMarketReceipt.gasUsed.toString(),
        },
      };
      
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
      console.log("✅ Contracts deployed successfully");
    }

    const deploymentInfo: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("📄 Using contracts from deployment:", deploymentPath);

    // Get contract instances
    const predictionMarket = await viem.getContractAt("PredictionMarket", deploymentInfo.contracts.predictionMarket);
    const marketTokens = await viem.getContractAt("MarketTokens", deploymentInfo.contracts.marketTokens);

    console.log("\n📊 Contract Addresses:");
    console.log("MarketTokens:", deploymentInfo.contracts.marketTokens);
    console.log("PredictionMarket:", deploymentInfo.contracts.predictionMarket);

    // Step 1: Authorize Oracle
    console.log("\n2️⃣ Authorizing Oracle...");
    try {
      const authHash = await predictionMarket.write.authorizeOracle([oracle.account.address]);
      const authReceipt = await publicClient.waitForTransactionReceipt({ hash: authHash });
      
      testResults.push({
        step: "Authorize Oracle",
        success: true,
        gasUsed: authReceipt.gasUsed.toString(),
        data: { oracle: oracle.account.address },
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("✅ Oracle authorized successfully");
    } catch (error: any) {
      testResults.push({
        step: "Authorize Oracle",
        success: false,
        error: error.message,
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("❌ Failed to authorize oracle:", error.message);
    }

    // Step 2: Create Market
    console.log("\n3️⃣ Creating Prediction Market...");
    try {
      const endTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const question = "Will the price of HBAR reach $0.10 by end of 2024?";
      const initialCollateral = parseEther("10"); // 10 HBAR
      
      const createHash = await predictionMarket.write.createMarket(
        [question, BigInt(endTime), oracle.account.address],
        { value: initialCollateral }
      );
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      
      // Get market ID from event
      const marketCreatedEvent = createReceipt.logs.find(log => 
        log.topics[0] === "0x" + "MarketCreated".padEnd(64, "0")
      );
      
      let marketId = 0;
      if (marketCreatedEvent) {
        marketId = parseInt(marketCreatedEvent.topics[1], 16);
      }
      
      testResults.push({
        step: "Create Market",
        success: true,
        gasUsed: createReceipt.gasUsed.toString(),
        data: { 
          marketId, 
          question, 
          endTime, 
          initialCollateral: initialCollateral.toString() 
        },
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("✅ Market created successfully");
      console.log("   Market ID:", marketId);
      console.log("   Question:", question);
    } catch (error: any) {
      testResults.push({
        step: "Create Market",
        success: false,
        error: error.message,
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("❌ Failed to create market:", error.message);
      return; // Can't continue without a market
    }

    // Step 3: User 1 buys YES tokens
    console.log("\n4️⃣ User 1 buying YES tokens...");
    try {
      const tokensToReceive = parseEther("5"); // 5 tokens
      const buyHash = await predictionMarket.write.buyTokens(
        [BigInt(0), true, tokensToReceive], // marketId=0, isYesToken=true
        { value: parseEther("5"), account: user1.account } // 5 HBAR payment
      );
      const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });
      
      testResults.push({
        step: "User 1 Buy YES Tokens",
        success: true,
        gasUsed: buyReceipt.gasUsed.toString(),
        data: { 
          tokensReceived: tokensToReceive.toString(),
          payment: parseEther("5").toString()
        },
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("✅ User 1 bought YES tokens successfully");
    } catch (error: any) {
      testResults.push({
        step: "User 1 Buy YES Tokens",
        success: false,
        error: error.message,
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("❌ Failed to buy YES tokens:", error.message);
    }

    // Step 4: User 2 buys NO tokens
    console.log("\n5️⃣ User 2 buying NO tokens...");
    try {
      const tokensToReceive = parseEther("3"); // 3 tokens
      const buyHash = await predictionMarket.write.buyTokens(
        [BigInt(0), false, tokensToReceive], // marketId=0, isYesToken=false
        { value: parseEther("3"), account: user2.account } // 3 HBAR payment
      );
      const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });
      
      testResults.push({
        step: "User 2 Buy NO Tokens",
        success: true,
        gasUsed: buyReceipt.gasUsed.toString(),
        data: { 
          tokensReceived: tokensToReceive.toString(),
          payment: parseEther("3").toString()
        },
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("✅ User 2 bought NO tokens successfully");
    } catch (error: any) {
      testResults.push({
        step: "User 2 Buy NO Tokens",
        success: false,
        error: error.message,
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("❌ Failed to buy NO tokens:", error.message);
    }

    // Step 5: Oracle reports outcome (YES)
    console.log("\n6️⃣ Oracle reporting outcome...");
    try {
      const reportHash = await predictionMarket.write.reportOutcome(
        [BigInt(0), 1], // marketId=0, outcome=1 (YES)
        { account: oracle.account }
      );
      const reportReceipt = await publicClient.waitForTransactionReceipt({ hash: reportHash });
      
      testResults.push({
        step: "Oracle Report Outcome",
        success: true,
        gasUsed: reportReceipt.gasUsed.toString(),
        data: { outcome: "YES" },
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("✅ Oracle reported outcome: YES");
    } catch (error: any) {
      testResults.push({
        step: "Oracle Report Outcome",
        success: false,
        error: error.message,
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("❌ Failed to report outcome:", error.message);
    }

    // Step 6: User 1 claims winnings
    console.log("\n7️⃣ User 1 claiming winnings...");
    try {
      const tokensToBurn = parseEther("2"); // Burn 2 tokens
      
      // Note: In a real scenario, users would need to transfer tokens to the contract first
      // This is a simplified test
      const claimHash = await predictionMarket.write.claimWinnings(
        [BigInt(0), tokensToBurn],
        { account: user1.account }
      );
      const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
      
      testResults.push({
        step: "User 1 Claim Winnings",
        success: true,
        gasUsed: claimReceipt.gasUsed.toString(),
        data: { tokensBurned: tokensToBurn.toString() },
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("✅ User 1 claimed winnings successfully");
    } catch (error: any) {
      testResults.push({
        step: "User 1 Claim Winnings",
        success: false,
        error: error.message,
        contractAddress: deploymentInfo.contracts.predictionMarket
      });
      console.log("❌ Failed to claim winnings:", error.message);
    }

    // Save test results
    const testPath = path.join(__dirname, "..", "deployments", `${network.name}-integration-test.json`);
    fs.writeFileSync(testPath, JSON.stringify(testResults, null, 2));
    console.log("\n📄 Test results saved to:", testPath);

    // Display summary
    console.log("\n🎉 Integration Test Summary:");
    console.log("===========================");
    
    const successfulSteps = testResults.filter(r => r.success).length;
    const totalSteps = testResults.length;
    
    testResults.forEach(result => {
      const status = result.success ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} ${result.step}`);
      if (result.gasUsed) {
        console.log(`   Gas used: ${result.gasUsed}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n📊 Results: ${successfulSteps}/${totalSteps} steps passed`);
    
    if (successfulSteps === totalSteps) {
      console.log("🎉 All tests passed! The prediction market system is working correctly.");
    } else {
      console.log("⚠️  Some tests failed. Check the errors above.");
    }

    console.log("\n🔗 Contract Information:");
    console.log("MarketTokens:", deploymentInfo.contracts.marketTokens);
    console.log("PredictionMarket:", deploymentInfo.contracts.predictionMarket);
    
    console.log("\n📋 Next Steps:");
    console.log("1. Deploy to Hedera Testnet: npm run deploy:hedera");
    console.log("2. Verify contracts: npm run verify:hedera");
    console.log("3. Start frontend: cd ../frontend && npm run dev");
    console.log("4. Test the complete user interface");

  } catch (error) {
    console.error("❌ Integration test failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
