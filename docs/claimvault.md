## Claim Vault
The claim vault is a smart contract that manages all reward claiming for the Aqtis ecosystem. It is composed of three smart contracts:

* [ClaimVault.sol](../contracts/rewards/ClaimVault.sol): The main contract that manages all reward claiming for the user
* [MintingBonus.sol](../contracts/rewards/MintingBonus.sol): A contract that handles promotion programs in the form of Aqtis Token rewards
* [LSTSwap.sol](../contracts/trade/LSTSwap.sol): A contract that handles the swapping of LST rewards for other tokens

All rewards other than Aqtis token are distributed to the user are pulled from the supported Uniswap V3 liquidity pools for the Aqtis ecosystem. The rewards are distributed in the form of Aqtis Tokens, USDC, and ETH. Each reward claiming will have a downward pressure on the price of the LST token. Aqtis will separately manage a buyback program to counteract this pressure.

AQTIS token rewards are unique, in that the contract will be pre-funded with Aqtis token to cover outstanding and future rewards. As the Aqtis ecosystem develops, further mechanisms to fund the ClaimVault with AQTIS token may be developed.

### Claiming Rewards
A general claim flow from a technical perspective is as follows:

* User initiates claim flow by calling `claimRewards()`
* The ClaimVault contract will call the `getRewardsFor(address user)` function on the corresponding LP to get the amount of rewards owed to the user
* The claim vault contract with then initiate a swap with the corresponding Uniswap LP pool to retrieve the correct reward amount
* The Uniswap Callback function is used to mint the proper amount of LST for the swap.
* The claim vault contract will then distribute the rewards to the user

Aqtis rewards are the only rewards that are not pulled from the Uniswap LP pools, but must be funded on the ClaimVault contract itself.

In order to maintain the security of the Uniswap V3 pool swaps, the Claim vault contract has some parameters that can be tuned. The contract will use the running average price of the LST to set a minimum output amount for the swap (currently defaulting to 30 min average), and the minimum output is a percentage of the current price times the amount of LST being swapped. This percentage is currently set to 97%.

## Minting Bonus
The minting bonus program enables Aqtis to further incentivize users to aquire LSTs. This minting bonus forms a slightly different structure than the rest of the LSTs.

Minting bonuses are set as a fixed amount of AQTIS token and for a fixed period of time. As users hold LSTs during that timeframe, they are eligible to claim a percent of the rewards tokens equivalent to the percent of that LST token's circulating supply over the period since their last claim.