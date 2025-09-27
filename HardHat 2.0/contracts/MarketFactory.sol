// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Market.sol";
import "./MarketTokens.sol";

/**
 * @title MarketFactory
 * @dev Deploys and keeps track of individual Market contracts.
 */
contract MarketFactory is Ownable {
    MarketTokens public immutable marketTokenManager;
    address[] public allMarkets;

    event MarketCreated(
        uint256 indexed marketId,
        address indexed marketAddress,
        string question,
        address oracle,
        address yesToken,
        address noToken
    );
    
    event MarketCreatedFromAnalysis(
        uint256 indexed marketId,
        address indexed marketAddress,
        address indexed contractToAnalyze,
        string contractHash,
        uint256 confidenceScore
    );

    constructor(address _marketTokenManager) Ownable(msg.sender) {
        marketTokenManager = MarketTokens(_marketTokenManager);
    }

    /**
     * @dev Creates a new prediction market by deploying a new Market contract.
     * The factory first creates the HTS tokens and then passes them to the new Market.
     */
    function createMarket(
        string calldata _question,
        uint256 _endTime,
        address _oracle,
        string calldata _yesSymbol,
        string calldata _noSymbol
    ) external {
        // FIX: Moved complex logic to a helper function to avoid "Stack too deep" error.
        (address newMarketAddress, address yesToken, address noToken) = _deployNewMarket(
            _question,
            _endTime,
            _oracle,
            _yesSymbol,
            _noSymbol,
            address(0), // No contract to analyze
            "", // No contract hash
            0 // No confidence score
        );

        // Store and emit the new market's address
        uint256 marketId = allMarkets.length;
        allMarkets.push(newMarketAddress);
        emit MarketCreated(marketId, newMarketAddress, _question, _oracle, yesToken, noToken);
    }
    
    /**
     * @dev Creates a prediction market based on AI analysis results.
     */
    function createMarketFromAnalysis(
        address _contractToAnalyze,
        string calldata _contractHash,
        uint256 _confidenceScore,
        uint256 _endTime,
        address _oracle
    ) external returns (address marketAddress) {
        require(_contractToAnalyze != address(0), "Contract address cannot be zero");
        require(bytes(_contractHash).length > 0, "Contract hash cannot be empty");
        require(_confidenceScore <= 10000, "Confidence score must be <= 10000");
        
        // Generate question based on contract analysis
        string memory question = string.concat(
            "Does contract at ",
            _addressToString(_contractToAnalyze),
            " contain exploitable vulnerabilities?"
        );
        
        string memory yesSymbol = string.concat("VUL_", _contractHash);
        string memory noSymbol = string.concat("SEC_", _contractHash);
        
        (address newMarketAddress, address yesToken, address noToken) = _deployNewMarket(
            question,
            _endTime,
            _oracle,
            yesSymbol,
            noSymbol,
            _contractToAnalyze,
            _contractHash,
            _confidenceScore
        );
        
        uint256 marketId = allMarkets.length;
        allMarkets.push(newMarketAddress);
        
        emit MarketCreated(marketId, newMarketAddress, question, _oracle, yesToken, noToken);
        emit MarketCreatedFromAnalysis(marketId, newMarketAddress, _contractToAnalyze, _contractHash, _confidenceScore);
        
        return newMarketAddress;
    }

    /**
     * @dev Internal helper function to handle the complex parts of market creation.
     * This isolates the external call and contract creation to reduce stack pressure.
     */
    function _deployNewMarket(
        string calldata _question,
        uint256 _endTime,
        address _oracle,
        string calldata _yesSymbol,
        string calldata _noSymbol,
        address _contractToAnalyze,
        string memory _contractHash,
        uint256 _confidenceScore
    ) internal returns (address marketAddress, address yesTokenAddress, address noTokenAddress) {
        // Step 1: Factory creates the HTS tokens by calling the MarketTokens contract.
        string memory yesName = string.concat("YES: ", _question);
        string memory noName = string.concat("NO: ", _question);

        (address yesToken, address noToken) = marketTokenManager.createMarketTokens(
            yesName,
            _yesSymbol,
            noName,
            _noSymbol
        );

        // Step 2: Deploy a new instance of the Market contract with all required arguments.
        Market newMarket = new Market(
            _question,
            _endTime,
            _oracle,
            address(marketTokenManager),
            yesToken,
            noToken,
            address(this), // The factory is the owner of the new market
            _contractToAnalyze,
            _contractHash,
            _confidenceScore
        );
        
        // Step 3: Return the created addresses
        marketAddress = address(newMarket);
        yesTokenAddress = yesToken;
        noTokenAddress = noToken;
    }
    
    /**
     * @dev Converts address to string for question generation.
     */
    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }

    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    function getMarketAddress(uint256 _marketId) external view returns (address) {
        require(_marketId < allMarkets.length, "Market ID out of bounds");
        return allMarkets[_marketId];
    }
}

