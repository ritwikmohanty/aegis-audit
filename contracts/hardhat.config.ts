import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable } from "hardhat/config";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    hederaTestnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("HEDERA_TESTNET_RPC_URL"),
      accounts: [configVariable("HEDERA_TESTNET_PRIVATE_KEY")],
      chainId: 296,
      // Manually set a gas price to avoid EIP-1559 fee calculation issues
      gasPrice: 83000000000,
    },
    hederaMainnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("HEDERA_MAINNET_RPC_URL"),
      accounts: [configVariable("HEDERA_MAINNET_PRIVATE_KEY")],
      chainId: 295,
      // Manually set a gas price to avoid EIP-1559 fee calculation issues
      gasPrice: 83000000000, // Note: You may need to adjust this for mainnet
    },
  },
};

export default config;