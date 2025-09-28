import 'dotenv/config';
import { Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicId, AccountBalanceQuery } from '@hashgraph/sdk';

/**
 * Creates and configures a Hedera client.
 */
function createClient() {
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKeyStr = process.env.HEDERA_PRIVATE_KEY;

    if (!accountId || !privateKeyStr) {
        throw new Error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in your .env file");
    }

    try {
        // Handle hex-encoded private key (with or without 0x prefix)
        const cleanPrivateKey = privateKeyStr.startsWith('0x') ? privateKeyStr.slice(2) : privateKeyStr;
        const privateKey = PrivateKey.fromStringECDSA(cleanPrivateKey);
        
        return Client.forTestnet().setOperator(accountId, privateKey);
    } catch (error) {
        throw new Error(`Invalid HEDERA_PRIVATE_KEY format: ${error.message}`);
    }
}

/**
 * Creates a new HCS topic for testing
 */
async function createTopic(client) {
    console.log("Creating new HCS topic...");
    
    try {
        const transaction = new TopicCreateTransaction()
            .setTopicMemo("Aegis Audit - Agent 1 Test Topic");
        
        const response = await transaction.execute(client);
        const receipt = await response.getReceipt(client);
        const topicId = receipt.topicId;
        
        console.log(`✅ Topic created successfully: ${topicId}`);
        return topicId;
    } catch (error) {
        console.error(`❌ Failed to create topic: ${error.message}`);
        throw error;
    }
}

/**
 * Submits a test message to HCS topic
 */
async function submitMessage(client, topicId, message) {
    console.log(`Submitting message to topic ${topicId}...`);
    
    try {
        const transaction = new TopicMessageSubmitTransaction({
            topicId: topicId,
            message: message,
        });
        
        const response = await transaction.execute(client);
        const receipt = await response.getReceipt(client);
        
        console.log(`✅ Message submitted successfully`);
        console.log(`   Transaction ID: ${response.transactionId}`);
        console.log(`   Sequence Number: ${receipt.topicSequenceNumber}`);
        return receipt;
    } catch (error) {
        console.error(`❌ Failed to submit message: ${error.message}`);
        throw error;
    }
}

/**
 * Main testing function
 */
async function testHcsIntegration() {
    console.log("🧪 Testing HCS Integration...\n");
    
    // Check if we're in test mode
    if (process.env.TEST_MODE === 'true') {
        console.log("⚠️  TEST_MODE is enabled - HCS operations will be skipped");
        console.log("   To test real HCS integration, set TEST_MODE=false and provide valid credentials\n");
        return;
    }
    
    let client;
    
    try {
        // 1. Create client
        console.log("1. Creating Hedera client...");
        client = createClient();
        console.log("✅ Client created successfully\n");
        
        // 2. Test account balance (to verify credentials)
        console.log("2. Checking account balance...");
        const accountId = process.env.HEDERA_ACCOUNT_ID;
        const balance = await new AccountBalanceQuery()
            .setAccountId(accountId)
            .execute(client);
        console.log(`✅ Account balance: ${balance.hbars} HBAR\n`);
        
        // 3. Create a test topic
        const topicId = await createTopic(client);
        console.log();
        
        // 4. Submit test messages
        await submitMessage(client, topicId, "[Agent 1][test-001] HCS integration test - initialization");
        await submitMessage(client, topicId, "[Agent 1][test-001] HCS integration test - analysis started");
        await submitMessage(client, topicId, "[Agent 1][test-001] HCS integration test - analysis completed");
        
        console.log("\n🎉 HCS Integration test completed successfully!");
        console.log(`📝 Test topic ID: ${topicId}`);
        console.log("   You can use this topic ID in your .env file for future tests");
        
    } catch (error) {
        console.error(`\n❌ HCS Integration test failed: ${error.message}`);
        
        if (error.message.includes("INVALID_SIGNATURE")) {
            console.log("\n💡 Troubleshooting tips:");
            console.log("   - Verify your HEDERA_ACCOUNT_ID is correct");
            console.log("   - Verify your HEDERA_PRIVATE_KEY is in the correct format");
            console.log("   - Ensure your account has sufficient HBAR balance");
        }
        
        process.exit(1);
    } finally {
        if (client) {
            client.close();
        }
    }
}

// Run the test
testHcsIntegration().catch(console.error);