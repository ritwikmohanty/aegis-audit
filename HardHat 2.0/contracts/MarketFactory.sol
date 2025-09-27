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
            _noSymbol
        );

        // Store and emit the new market's address
        uint256 marketId = allMarkets.length;
        allMarkets.push(newMarketAddress);
        emit MarketCreated(marketId, newMarketAddress, _question, _oracle, yesToken, noToken);
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
        string calldata _noSymbol
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

        // Step 2: Deploy a new instance of the Market contract with all 7 required arguments.
        Market newMarket = new Market(
            _question,
            _endTime,
            _oracle,
            address(marketTokenManager),
            yesToken,
            noToken,
            address(this) // The factory is the owner of the new market
        );
        
        // Step 3: Return the created addresses
        marketAddress = address(newMarket);
        yesTokenAddress = yesToken;
        noTokenAddress = noToken;
    }

    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    function getMarketAddress(uint256 _marketId) external view returns (address) {
        require(_marketId < allMarkets.length, "Market ID out of bounds");
        return allMarkets[_marketId];
    }
}

