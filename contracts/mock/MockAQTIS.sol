// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Mock AQTIS Token Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract handles tokenomics for a Mock AQTIS Token 
 */

// ======= OpenZeppelin v5.0.1 ======= //
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAQTIS is ERC20 {
    constructor() ERC20("Mock AQTIS", "MAQTIS") {
        _mint(msg.sender, 3000000000 * (10 ** uint256(decimals())));
    }
}