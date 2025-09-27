// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MarketTokens
 * @dev An ERC1155 contract to manage all YES/NO tokens for the PredictionMarket.
 * Each market gets two token IDs: one for YES, one for NO.
 * This is highly gas-efficient compared to deploying new ERC20s per market.
 */
contract MarketTokens is ERC1155, Ownable {
    // The main PredictionMarket contract address
    address public predictionMarket;

    constructor(address _predictionMarket) ERC1155("") Ownable(msg.sender) {
        predictionMarket = _predictionMarket;
    }

    /**
     * @dev Mints tokens. Only callable by the PredictionMarket contract.
     */
    function mint(address to, uint256 id, uint256 amount, bytes memory data) external {
        require(msg.sender == predictionMarket, "Only prediction market can mint");
        _mint(to, id, amount, data);
    }

    /**
     * @dev Burns tokens. Only callable by the PredictionMarket contract.
     */
    function burn(address from, uint256 id, uint256 amount) external {
        require(msg.sender == predictionMarket, "Only prediction market can burn");
        _burn(from, id, amount);
    }

    // Optional: You can implement a uri function to point to token metadata
    function uri(uint256 id) public view override returns (string memory) {
        // You could build a metadata server that returns details based on the ID
        return "";
    }
}