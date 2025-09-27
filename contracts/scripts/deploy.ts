import { network } from "hardhat";
import { formatEther, parseEther } from "viem";

async function main() {
    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const [deployer] = await viem.getWalletClients();

    console.log("Deploying contracts with the account:", deployer.account.address);

    const balance = await publicClient.getBalance({
        address: deployer.account.address,
    });
    console.log("Account balance:", formatEther(balance));

    // 1. Deploy MarketTokens contract
    // The constructor requires the address of the PredictionMarket contract.
    // We will deploy it first with a placeholder address (the deployer's address)
    // and then update it after PredictionMarket is deployed.
    const marketTokens = await viem.deployContract("MarketTokens", [deployer.account.address]);
    console.log("MarketTokens deployed to:", marketTokens.address);

    // 2. Deploy PredictionMarket contract
    const predictionMarket = await viem.deployContract("PredictionMarket", [marketTokens.address]);
    console.log("PredictionMarket deployed to:", predictionMarket.address);

    // 3. Set the correct PredictionMarket address in the MarketTokens contract
    // This is a critical step for the security model to work correctly.
    const hash = await marketTokens.write.setPredictionMarket([predictionMarket.address]);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("MarketTokens `predictionMarket` address updated to:", predictionMarket.address);

    console.log("Deployment complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});