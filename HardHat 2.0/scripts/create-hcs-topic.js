const { ethers } = require("hardhat");
const { Client, TopicCreateTransaction, PrivateKey } = require("@hashgraph/sdk");

async function main() {
  console.log("📡 Creating HCS Topic for AuditTrail...");

  // Get environment variables
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;

  if (!accountId || !privateKey) {
    console.error("❌ Missing environment variables:");
    console.error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY are required");
    process.exit(1);
  }

  try {
    // Create Hedera client
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);

    console.log("📋 Account ID:", accountId);
    console.log("🔑 Using private key:", privateKey.substring(0, 10) + "...");

    // Create HCS topic
    const topicTransaction = new TopicCreateTransaction()
      .setTopicMemo("Aegis Audit Trail - AI Analysis Logs")
      .setSubmitKey(PrivateKey.fromString(privateKey));

    console.log("\n📤 Submitting topic creation transaction...");
    const topicResponse = await topicTransaction.execute(client);
    
    console.log("⏳ Waiting for transaction confirmation...");
    const topicReceipt = await topicResponse.getReceipt(client);
    const topicId = topicReceipt.topicId;

    console.log("✅ HCS Topic created successfully!");
    console.log("📋 Topic ID:", topicId.toString());

    // Convert topic ID to contract address format
    const topicAddress = "0x" + topicId.num.toString(16).padStart(40, "0");
    console.log("🔗 Topic Address (for contract):", topicAddress);

    // Save topic info
    const topicInfo = {
      topicId: topicId.toString(),
      topicAddress: topicAddress,
      accountId: accountId,
      timestamp: new Date().toISOString(),
      network: "testnet"
    };

    const fs = require("fs");
    const path = require("path");
    const topicPath = path.join(__dirname, "..", "deployments", "hcs_topic.json");
    
    const topicDir = path.dirname(topicPath);
    if (!fs.existsSync(topicDir)) {
      fs.mkdirSync(topicDir, { recursive: true });
    }
    
    fs.writeFileSync(topicPath, JSON.stringify(topicInfo, null, 2));
    console.log("💾 Topic info saved to:", topicPath);

    console.log("\n🔗 Hashscan Links:");
    console.log("Topic:", `https://testnet.hashscan.io/topic/${topicId.toString()}`);

    console.log("\n📝 Next steps:");
    console.log("1. Update your AuditTrail contract with the topic address:", topicAddress);
    console.log("2. Redeploy the AuditTrail contract with the new topic address");
    console.log("3. The topic address can be used as the _topicId parameter in the AuditTrail constructor");

  } catch (error) {
    console.error("\n❌ Failed to create HCS topic:", error);
    
    if (error.message.includes("INSUFFICIENT_ACCOUNT_BALANCE")) {
      console.error("💡 Make sure your Hedera account has sufficient HBAR for the transaction");
    } else if (error.message.includes("INVALID_ACCOUNT_ID")) {
      console.error("💡 Check your HEDERA_ACCOUNT_ID environment variable");
    } else if (error.message.includes("INVALID_PRIVATE_KEY")) {
      console.error("💡 Check your HEDERA_PRIVATE_KEY environment variable");
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
