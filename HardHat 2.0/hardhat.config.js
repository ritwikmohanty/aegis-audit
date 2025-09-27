require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    hedera_testnet: {
      url: process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api",
      accounts: process.env.HEDERA_TESTNET_PRIVATE_KEY ? [process.env.HEDERA_TESTNET_PRIVATE_KEY] : [],
      chainId: 296,
      gas: 30000000,
      gasPrice: 100000000, // 0.1 gwei
    },
    hedera_mainnet: {
      url: process.env.HEDERA_MAINNET_RPC_URL || "https://mainnet.hashio.io/api",
      accounts: process.env.HEDERA_MAINNET_PRIVATE_KEY ? [process.env.HEDERA_MAINNET_PRIVATE_KEY] : [],
      chainId: 295,
      gas: 30000000,
      gasPrice: 100000000, // 0.1 gwei
    },
  },
  etherscan: {
    apiKey: {
      hedera_testnet: process.env.HEDERA_API_KEY || "",
      hedera_mainnet: process.env.HEDERA_API_KEY || "",
    },
    customChains: [
      {
        network: "hedera_testnet",
        chainId: 296,
        urls: {
          apiURL: "https://api-testnet.hedera.com",
          browserURL: "https://testnet.hashscan.io",
        },
      },
      {
        network: "hedera_mainnet",
        chainId: 295,
        urls: {
          apiURL: "https://api.hedera.com",
          browserURL: "https://hashscan.io",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};