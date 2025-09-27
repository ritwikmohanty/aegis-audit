import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function main() {
  console.log("🚀 Starting Hedera Testnet Transaction...");

  // Get ethers from the Hardhat Runtime Environment
  const { ethers } = hre;

  // --- 1. Set up connection to Hedera Testnet ---
  const provider = new ethers.JsonRpcProvider(process.env.HEDERA_TESTNET_RPC_URL);
  
  const privateKey = process.env.HEDERA_TESTNET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("❌ HEDERA_TESTNET_PRIVATE_KEY is not set in the .env file. Please add it.");
  }

  // The 'sender' is a wallet instance that can sign transactions
  const sender = new ethers.Wallet(privateKey, provider);
  
  console.log("\n📋 Transaction Details:");
  console.log("Network: Hedera Testnet");
  console.log("Sending from:", sender.address);
  console.log("Sending to:  ", sender.address);

  const balance = await provider.getBalance(sender.address);
  console.log("Account balance:", ethers.formatEther(balance), "HBAR");
  
  if (balance < 10000000000n) { // Check if balance is less than 1 tinybar
      console.warn("⚠️  Warning: Account balance is very low.");
  }

  // --- 2. Send a simple transaction ---
  console.log("\n📡 Sending 1 tinybar transaction...");
  const tx = await sender.sendTransaction({
    to: sender.address,
    value: 10000000000n, // Sending 1 tinybar (10^10 wei)
  });

  console.log("   Transaction sent with hash:", tx.hash);
  console.log("   Waiting for confirmation...");

  // --- 3. Wait for the transaction to be confirmed ---
  await tx.wait();

  console.log("\n🎉 Transaction confirmed successfully!");

  const newBalance = await provider.getBalance(sender.address);
  console.log("   New account balance:", ethers.formatEther(newBalance), "HBAR");
}

main().catch((error) => {
  console.error("\n❌ Operation failed:", error);
  process.exitCode = 1;
});

