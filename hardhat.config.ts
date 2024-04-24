import { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-ganache";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";
import "./tasks";
import * as dotenv from "dotenv";
import * as process from "process";


dotenv.config();

const UNISWAP_SETTING = {
  version: "0.7.6",
  settings: {
    optimizer: {
      enabled: true,
      runs: 2_000,
    },
  },
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: "0.7.0",
      },
      {
        version: "0.7.5",
      },
      {
        version: "0.7.6",
      },
      {
        version: "0.8.0",
      },
      UNISWAP_SETTING
    ],
    overrides: {
      '@uniswap/v3-core/contracts/libraries/FullMath.sol': UNISWAP_SETTING,
      '@uniswap/v3-core/contracts/libraries/TickMath.sol': UNISWAP_SETTING,
      '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol': UNISWAP_SETTING,
      '@uniswap/v3-periphery/contracts/libraries/CallbackValidation.sol': UNISWAP_SETTING,
    }
  },
  namedAccounts: {
    deployer: {
      default: 0
    }
  },
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.SEPOLIA_ALCHEMY_API_KEY}`,
      accounts: [process.env.TESTNET_DEPLOYER_PRIVATE_KEY || ""],
      tags: [
        "testnet"
      ],
    },
    mainnet: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.MAINNET_ALCHEMY_API_KEY}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY || ""]
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
    }
  },
  sourcify: {
    enabled: true
  }
};

export default config;