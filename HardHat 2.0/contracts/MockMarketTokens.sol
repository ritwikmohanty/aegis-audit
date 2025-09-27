// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockMarketTokens
 * @dev Mock version of MarketTokens for testing without HTS precompiles
 */
contract MockMarketTokens is Ownable {
    address public predictionMarket;
    
    // Mock token storage
    address[] public allTokens;
    mapping(address => bool) public isToken;
    
    event MockTokenCreated(address indexed tokenAddress, string name, string symbol);

    constructor(address _predictionMarket) Ownable(msg.sender) {
        predictionMarket = _predictionMarket;
    }

    /**
     * @dev Mock version of createMarketTokens that creates mock tokens
     */
    function createMarketTokens(
        string memory yesName,
        string memory yesSymbol,
        string memory noName,
        string memory noSymbol
    ) external returns (address yesTokenAddress, address noTokenAddress) {
        require(msg.sender == predictionMarket, "Only prediction market can create tokens");

        // Create mock token addresses (using CREATE2 or simple counter)
        yesTokenAddress = _createMockToken(yesName, yesSymbol);
        noTokenAddress = _createMockToken(noName, noSymbol);
    }

    /**
     * @dev Creates a mock token address
     */
    function _createMockToken(string memory name, string memory symbol) internal returns (address) {
        // Create a deterministic address based on the current data
        bytes32 hash = keccak256(abi.encodePacked(name, symbol, block.timestamp, allTokens.length));
        address tokenAddress = address(uint160(uint256(hash)));
        
        allTokens.push(tokenAddress);
        isToken[tokenAddress] = true;
        
        emit MockTokenCreated(tokenAddress, name, symbol);
        return tokenAddress;
    }

    /**
     * @dev Allows the owner to set the PredictionMarket contract address.
     */
    function setPredictionMarket(address _newPredictionMarket) external onlyOwner {
        require(_newPredictionMarket != address(0), "Invalid address");
        predictionMarket = _newPredictionMarket;
    }

    /**
     * @dev Get the number of tokens created
     */
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @dev Get token address by index
     */
    function getTokenAddress(uint256 index) external view returns (address) {
        require(index < allTokens.length, "Token index out of bounds");
        return allTokens[index];
    }
}
