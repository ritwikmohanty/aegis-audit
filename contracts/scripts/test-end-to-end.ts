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
}

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2, oracle] = await viem.getWalletClients();

  console.log("🧪 Starting End-to-End Test...");
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

  const testResults: TestResult[] = [];

  try {
    // Get contract instances
    const predictionMarket = await viem.getContractAt("PredictionMarket", deploymentInfo.contracts.predictionMarket);
    const marketTokens = await viem.getContractAt("MarketTokens", deploymentInfo.contracts.marketTokens);

    console.log("\n📋 Test Participants:");
    console.log("Deployer (Owner):", deployer.account.address);
    console.log("User 1 (Bettor):", user1.account.address);
    console.log("User 2 (Bettor):", user2.account.address);
    console.log("Oracle:", oracle.account.address);

    // Step 1: Authorize Oracle
    console.log("\n1️⃣ Authorizing Oracle...");
    try {
      const authHash = await predictionMarket.write.authorizeOracle([oracle.account.address]);
      const authReceipt = await publicClient.waitForTransactionReceipt({ hash: authHash });
      
      testResults.push({
        step: "Authorize Oracle",
        success: true,
        gasUsed: authReceipt.gasUsed.toString(),
        data: { oracle: oracle.account.address }
      });
      console.log("✅ Oracle authorized successfully");
    } catch (error: any) {
      testResults.push({
        step: "Authorize Oracle",
        success: false,
        error: error.message
      });
      console.log("❌ Failed to authorize oracle:", error.message);
    }

    // Step 2: Create Market
    console.log("\n2️⃣ Creating Prediction Market...");
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
        }
      });
      console.log("✅ Market created successfully");
      console.log("   Market ID:", marketId);
      console.log("   Question:", question);
    } catch (error: any) {
      testResults.push({
        step: "Create Market",
        success: false,
        error: error.message
      });
      console.log("❌ Failed to create market:", error.message);
      return; // Can't continue without a market
    }

    // Step 3: User 1 buys YES tokens
    console.log("\n3️⃣ User 1 buying YES tokens...");
    try {
      const tokensToReceive = parseEther("5"); // 5 tokens
      const buyHash = await predictionMarket.write.buyTokens(
        [BigInt(0), true, tokensToReceive], // marketId=0, isYesToken=true
        { value: parseEther("5") } // 5 HBAR payment
      );
      const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });
      
      testResults.push({
        step: "User 1 Buy YES Tokens",
        success: true,
        gasUsed: buyReceipt.gasUsed.toString(),
        data: { 
          tokensReceived: tokensToReceive.toString(),
          payment: parseEther("5").toString()
        }
      });
      console.log("✅ User 1 bought YES tokens successfully");
    } catch (error: any) {
      testResults.push({
        step: "User 1 Buy YES Tokens",
        success: false,
        error: error.message
      });
      console.log("❌ Failed to buy YES tokens:", error.message);
    }

    // Step 4: User 2 buys NO tokens
    console.log("\n4️⃣ User 2 buying NO tokens...");
    try {
      const tokensToReceive = parseEther("3"); // 3 tokens
      const buyHash = await predictionMarket.write.buyTokens(
        [BigInt(0), false, tokensToReceive], // marketId=0, isYesToken=false
        { value: parseEther("3") } // 3 HBAR payment
      );
      const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });
      
      testResults.push({
        step: "User 2 Buy NO Tokens",
        success: true,
        gasUsed: buyReceipt.gasUsed.toString(),
        data: { 
          tokensReceived: tokensToReceive.toString(),
          payment: parseEther("3").toString()
        }
      });
      console.log("✅ User 2 bought NO tokens successfully");
    } catch (error: any) {
      testResults.push({
        step: "User 2 Buy NO Tokens",
        success: false,
        error: error.message
      });
      console.log("❌ Failed to buy NO tokens:", error.message);
    }

    // Step 5: Oracle reports outcome (YES)
    console.log("\n5️⃣ Oracle reporting outcome...");
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
        data: { outcome: "YES" }
      });
      console.log("✅ Oracle reported outcome: YES");
    } catch (error: any) {
      testResults.push({
        step: "Oracle Report Outcome",
        success: false,
        error: error.message
      });
      console.log("❌ Failed to report outcome:", error.message);
    }

    // Step 6: User 1 claims winnings
    console.log("\n6️⃣ User 1 claiming winnings...");
    try {
      const tokensToBurn = parseEther("2"); // Burn 2 tokens
      
      // First, we need to transfer tokens to the contract for burning
      // This is a simplified test - in reality, users would need to approve/transfer
      const claimHash = await predictionMarket.write.claimWinnings(
        [BigInt(0), tokensToBurn],
        { account: user1.account }
      );
      const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
      
      testResults.push({
        step: "User 1 Claim Winnings",
        success: true,
        gasUsed: claimReceipt.gasUsed.toString(),
        data: { tokensBurned: tokensToBurn.toString() }
      });
      console.log("✅ User 1 claimed winnings successfully");
    } catch (error: any) {
      testResults.push({
        step: "User 1 Claim Winnings",
        success: false,
        error: error.message
      });
      console.log("❌ Failed to claim winnings:", error.message);
    }

    // Save test results
    const testPath = path.join(__dirname, "..", "deployments", `${network.name}-test-results.json`);
    fs.writeFileSync(testPath, JSON.stringify(testResults, null, 2));
    console.log("\n📄 Test results saved to:", testPath);

    // Display summary
    console.log("\n🎉 End-to-End Test Summary:");
    console.log("==========================");
    
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
      console.log("🎉 All tests passed! The system is working correctly.");
    } else {
      console.log("⚠️  Some tests failed. Check the errors above.");
    }

  } catch (error) {
    console.error("❌ Test process failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
