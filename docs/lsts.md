## LSTs

The LSTs are designed to generate yield without staking or farming. Users should only need to hold LSTs in their wallet in order to be entitled to rewards. Smart contracts, such as the Uniswap LP pools will not be able to claim rewards unless they are explicitly whitelisted for an Aqtis integration. The "circulating supply" for an LST is defined as the total supply minus the balance of the LSTs in the Uniswap LP pool or other smart contract.

Each LST has it's own defined reward distribution, each dependent on the users time-weighted average balance since the last claim. LST rewards are provided from the LST itself through tracking user balances over time. Each LST reward amount is dependent on different factors, but the rewards are distributed in three fixed tokens:

* AQTIS Token: the core token of the Aqtis Ecosystem
* USDC: a stablecoin pegged to the US Dollar
* ETH: the native token of the Ethereum network

The reward struct provided by each LST upon calling `getRewardsFor(address user)` is as follows:

```solidity
struct RewardsDistribution {
    uint256 usdcRewards;
    uint256 ethRewards;
    uint256 aqtisRewards;
    uint256 cappedLSTRewards;
}
```

USDC rewards, ETH rewards, and AQTIS rewards are considered "exact out" rewards, meaning they are distributed to the user in the exact amount specified. 

The capped LST rewards are considered "exact in" rewards. The will still be distributed as USDC and ETH (split 50/50 between the two), however they are capped by the current price of the LST. The rewards for a certain amount of `cappedLSTRewards` are therefore whatever amount of USDC/ETH are purchasable with that amount of LST.

### QSD

QSD can be purchased with either USDC or ETH, and the price of minting new tokens is fixed at 1 USD per QSD. The rewards for QSD are 12.5% of the minting price on a yearly basis, denominated in USDC, and 2.5% of the minting price on a yearly basis, denominated in AQTIS.

### QETH
QETH can be purchased only with ETH, and the price of minting new tokens is fixed at 1 ETH per QETH. The rewards for QETH are 7.5% of the minting price on a yearly basis, denominated in ETH, and 2.5% of the minting price on a yearly basis, denominated in AQTIS.

### QRT
QRT can be purchased with either USDC or ETH, and the price of minting new tokens is fixed at 10 USD per QRT. The rewards for QRT are dependent on the circulating supply (ie. the supply not locked in smart contracts). On a yearly basis the total yield of the QRT pool is 15% of the total supply, however for each user, their claim on that reward is dependent on their share of the circulating supply.

QRT rewards are denominated in QRT itself, and then sold off at current prices to return ETH and USDC. The rewards are split 50/50 between the two.