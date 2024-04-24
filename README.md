
# AQTIS Smart Contracts

## Introduction
Welcome to AQTIS Smart Contracts! This repository is dedicated to the smart contract code for AQTIS, a cutting-edge token system built on blockchain technology. Our goal is to create a decentralized, community-driven financial platform.

### Key Features
- **Token Logic**: The core logic of tokens is encapsulated within our contracts.
- **Seamless Transactions**: We prioritize secure and fluid transactions within the AQTIS ecosystem.

## Contracts
Here you can find more in-depth information on the smart contracts that make up the AQTIS ecosystem:
* [LSTs](docs/lsts.md)
* [Claim Vault](docs/claimvault.md)
* [Price Calculator](docs/pricecalculator.md)

## Getting Started
Follow these instructions to set up and interact with our smart contracts using Hardhat.

### Prerequisites
- Node.js
- Typescript
- [Hardhat](https://hardhat.org/getting-started/)
- A Web3 Provider (e.g., MetaMask)

### Installation
To get started, clone the repository and install the dependencies:
```bash
git clone https://github.com/AQTISOfficial/aqtis-smart-contracts.git
cd aqtis-smart-contracts
npm install
```

### Deploy scripts to Ethereum
```bash
npx hardhat deploy --network [NETWORK]
```

### Run tests
```bash
npx hardhat test
```

## Contract Addresses
Here are the addresses for interacting with the AQTIS Smart Contracts:

### Mainnet Addresses
- **AQTIS Token**: `0x6ff2241756549b5816a177659e766eaf14b34429`
- **AQTIS/WETH Uniswap V2 Pair**: `0xb777d386a9f6bf14ff85d92b27dc70209141e787`

- **USDC**: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- **WETH**: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`

#### Chainlink Oracle Addresses
- **ETH/USD**: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`
- **USDC/USD**: `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6`

### Testnet Addresses

#### Chainlink Oracle Addresses
- **ETH/USD**: `0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e`
- **USDC/USD**: `0xAb5c49580294Aff77670F839ea425f5b78ab3Ae7`


## License
This project is licensed under the MIT License.

## Acknowledgments
A heartfelt thank you to all contributors and supporters of the AQTIS project.