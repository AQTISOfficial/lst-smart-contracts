// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Mock USD Token Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract handles tokenomics for a Mock USD Token 
 */

contract MockUSD is ERC20 {


    constructor() ERC20("USD Coin", "USDC"){

    }

     function decimals() public view override returns (uint8) {
        return 6;
    }

    function mint(address account, uint amount) external {
        _mint(account, amount);
    }
}