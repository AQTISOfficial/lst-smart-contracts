// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractLST} from "../lst/AbstractLST.sol";

contract MockAbstractLST is AbstractLST {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalMaxSupply
    ) AbstractLST(_name, _symbol, _totalMaxSupply) {}

    function buyTokensWithEth() external override payable {
    }

    function buyTokens(uint /*amount*/) external override {
    }

    function mint(uint amount) external override {
    }

    function mintWithCap(uint amount) external override {
    }

    function setRewardsAddress(address _rewardsAddress) external override {
    }

    function setTokenPriceCalculator(address _tokenPriceCalculator) external override {
    }
}
