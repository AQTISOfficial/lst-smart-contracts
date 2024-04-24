// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Compose LST Contract
 * @author A Q T I S / @AQTIS-Team
 * @notice This contract is used to distribute ETH to the LST contracts
 * @dev This contract uses OpenZeppelin contracts for added security.
 */

// ======= OpenZeppelin v5.0.1 ======= //
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ======= Interfaces ======= //
interface IQETH {
    function buyTokensWithEth() external payable;
}

interface IQSD {
    function buyTokensWithEth() external payable;
}

interface IQRT {
    function buyTokensWithEth() external payable;
}

// ======= Compose Contract ======= //
contract Compose is Ownable, ReentrancyGuard {
    IQETH public immutable qeth;
    IQSD public immutable qsd;
    IQRT public immutable qrt;

    uint256 public minAmountBuy = 0.05 ether;

    event MinAmountBuyChanged(uint256 newMinAmountBuy);

    // Constructor
    constructor(address _qeth, address _qsd, address _qrt) Ownable(msg.sender) {
        qeth = IQETH(_qeth);
        qsd = IQSD(_qsd);
        qrt = IQRT(_qrt);
    }

    // Functions
    function setMinAmountBuy(uint256 _newMinAmountBuy) external onlyOwner {
        require(_newMinAmountBuy > 0, "Min amount buy must be greater than 0");
        minAmountBuy = _newMinAmountBuy;
        emit MinAmountBuyChanged(_newMinAmountBuy);
    }

    /// Distribute Funds
    /// @notice This function distributes ETH to the LST contracts
    /// @dev This function is nonReentrant to prevent reentrancy attacks
    /// @param _percentageQeth percentage of ETH to send to QETH
    /// @param _percentageQsd percentage of ETH to send to QSD
    /// @param _percentageQrt percentage of ETH to send to QRT
    function distributeFunds(
        uint256 _percentageQeth,
        uint256 _percentageQsd,
        uint256 _percentageQrt
    ) external payable nonReentrant {
        require(
            _percentageQeth + _percentageQsd + _percentageQrt == 100,
            "Percentages must add up to 100"
        );
        
        require(
            msg.value >= minAmountBuy,
            "Amount sent is less than minimum amount"
        );

        uint256 amountQeth = (msg.value * _percentageQeth) / 100;
        uint256 amountQsd = (msg.value * _percentageQsd) / 100;
        uint256 amountQrt = msg.value - amountQeth - amountQsd;

        if (amountQeth > 0) {
            uint256 balanceBefore = IERC20(address(qeth)).balanceOf(address(this));
            qeth.buyTokensWithEth{ value: amountQeth }();
            uint256 tokensMinted = IERC20(address(qeth)).balanceOf(address(this)) - balanceBefore;
            transferTokens(IERC20(address(qeth)), msg.sender, tokensMinted);
        }
        
        if (amountQsd > 0) {
            uint256 balanceBefore = IERC20(address(qsd)).balanceOf(address(this));
            qsd.buyTokensWithEth{ value: amountQsd }();
            uint256 tokensMinted = IERC20(address(qsd)).balanceOf(address(this)) - balanceBefore;
            transferTokens(IERC20(address(qsd)), msg.sender, tokensMinted);
        }

        if (amountQrt > 0) {
            uint256 balanceBefore = IERC20(address(qrt)).balanceOf(address(this));
            qrt.buyTokensWithEth{ value: amountQrt }();
            uint256 tokensMinted = IERC20(address(qrt)).balanceOf(address(this)) - balanceBefore;
            transferTokens(IERC20(address(qrt)), msg.sender, tokensMinted);
        }
    }

    function transferTokens(IERC20 tokenContract, address recipient, uint256 amount) private {
        require(
            tokenContract.transfer(recipient, amount),
            "Token transfer failed"
        );
    }

    // Fallback function to accept ETH
    receive() external payable {}

    // Function to withdraw ETH from the contract (for safety)
    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }
}
