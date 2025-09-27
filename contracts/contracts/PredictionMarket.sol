// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MarketTokens.sol"; // Use the fixed version
import "./IHederaTokenService.sol";

/**
 * @title PredictionMarket
 * @dev A prediction market contract with corrected AMM functionality for HTS.
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    // --- Enums and Structs ---
    enum MarketStatus { Active, Resolved, Cancelled }
    enum MarketOutcome { Pending, Yes, No, Invalid }

    struct Market {
        uint256 id;
        string question;
        address creator;
        uint256 endTime;
        MarketStatus status;
        MarketOutcome outcome;
        address yesToken;
        address noToken;
        
        // FIX: AMM pools should represent the virtual supply available for trading
        uint256 yesTokenPool;
        uint256 noTokenPool;
        uint256 collateralPool; // HBAR pool
        
        address oracle;
    }

    // --- State Variables ---
    mapping(uint256 => Market) public markets;
    mapping(address => bool) public authorizedOracles;
    
    uint256 public marketCounter;
    MarketTokens public marketTokenFactory;
    
    address constant HTS_PRECOMPILE_ADDRESS = address(0x167);
    IHederaTokenService constant hts = IHederaTokenService(HTS_PRECOMPILE_ADDRESS);

    // --- Events ---
    event MarketCreated(uint256 indexed marketId, address indexed creator, string question, uint256 endTime, address yesToken, address noToken);
    event TokensPurchased(uint256 indexed marketId, address indexed buyer, bool isYesToken, uint256 collateralSpent, uint256 tokensReceived);
    event MarketResolved(uint256 indexed marketId, MarketOutcome outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    constructor(address _marketTokenFactoryAddress) Ownable(msg.sender) {
        marketTokenFactory = MarketTokens(_marketTokenFactoryAddress);
    }

    function createMarket(
        string memory _question,
        uint256 _endTime,
        address _oracle
    ) external payable nonReentrant returns (uint256) {
        require(_endTime > block.timestamp, "End time must be in the future");
        require(authorizedOracles[_oracle], "Unauthorized oracle");
        require(msg.value > 0, "Initial collateral required");

        uint256 marketId = marketCounter++;
        
        // Deploy YES and NO tokens via our factory
        (address yesToken, address noToken) = deployMarketTokens(marketId, _question);
        
        Market storage market = markets[marketId];
        market.id = marketId;
        market.question = _question;
        market.creator = msg.sender;
        market.endTime = _endTime;
        market.status = MarketStatus.Active;
        market.outcome = MarketOutcome.Pending;
        market.yesToken = yesToken;
        market.noToken = noToken;
        // FIX: The initial pool sizes are determined by the initial collateral
        market.yesTokenPool = msg.value;
        market.noTokenPool = msg.value;
        market.collateralPool = msg.value;
        market.oracle = _oracle;

        // Associate this contract with the new tokens
        address[] memory tokensToAssociate = new address[](2);
        tokensToAssociate[0] = yesToken;
        tokensToAssociate[1] = noToken;
        hts.associateTokens(address(this), tokensToAssociate);

        emit MarketCreated(marketId, msg.sender, _question, _endTime, yesToken, noToken);
        return marketId;
    }

    function buyTokens(uint256 _marketId, bool _isYesToken, uint256 _tokensToReceive) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Active, "Market not active");
        require(_tokensToReceive > 0, "Must buy more than zero tokens");
        require(_tokensToReceive <= type(uint64).max, "Amount exceeds HTS limit");

        // FIX: Correct AMM cost calculation. User specifies tokens to receive, we calculate cost.
        // Cost = (x_1 / y_1) * dy^2 + dy
        uint256 poolFrom = _isYesToken ? market.yesTokenPool : market.noTokenPool;
        uint256 poolTo = _isYesToken ? market.noTokenPool : market.yesTokenPool;
        
        uint256 cost = (poolTo * _tokensToReceive) / (poolFrom - _tokensToReceive);
        require(msg.value >= cost, "Insufficient payment for tokens");

        // Update pools
        market.collateralPool += cost;
        if (_isYesToken) {
            market.yesTokenPool -= _tokensToReceive;
            market.noTokenPool += _tokensToReceive;
        } else {
            market.noTokenPool -= _tokensToReceive;
            market.yesTokenPool += _tokensToReceive;
        }

        // Mint tokens to buyer via HTS
        address tokenToBuy = _isYesToken ? market.yesToken : market.noToken;
        hts.associateToken(msg.sender, tokenToBuy); // Ensure user is associated
        (int response, , ) = hts.mintToken(tokenToBuy, uint64(_tokensToReceive), new bytes[](0));
        require(response == 22, "HTS mint failed");

        emit TokensPurchased(_marketId, msg.sender, _isYesToken, cost, _tokensToReceive);

        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
    }

    function reportOutcome(uint256 _marketId, MarketOutcome _outcome) external {
        Market storage market = markets[_marketId];
        require(msg.sender == market.oracle, "Only authorized oracle");
        require(market.status == MarketStatus.Active, "Market has already resolved");
        require(block.timestamp >= market.endTime, "Market has not ended yet");
        require(_outcome == MarketOutcome.Yes || _outcome == MarketOutcome.No, "Outcome must be YES or NO");

        market.status = MarketStatus.Resolved;
        market.outcome = _outcome;
        emit MarketResolved(_marketId, _outcome);
    }
    
    function claimWinnings(uint256 _marketId, uint256 _amountToBurn) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Resolved, "Market not resolved");
        require(_amountToBurn > 0, "Must burn more than 0 tokens");
        require(_amountToBurn <= type(uint64).max, "Amount exceeds HTS limit");

        address winningToken;
        uint256 winningPool;

        if (market.outcome == MarketOutcome.Yes) {
            winningToken = market.yesToken;
            winningPool = market.yesTokenPool;
        } else if (market.outcome == MarketOutcome.No) {
            winningToken = market.noToken;
            winningPool = market.noTokenPool;
        } else {
            revert("Market outcome is invalid or not set");
        }
        
        // Payout is proportional to the share of the winning pool.
        uint256 payout = (market.collateralPool * _amountToBurn) / winningPool;

        // Burn the user's tokens. This requires the user to have transferred them to this contract first.
        (int response, ) = hts.burnToken(winningToken, uint64(_amountToBurn), new int64[](0));
        require(response == 22, "HTS burn failed. Ensure tokens were transferred here first.");

        // Send the HBAR payout
        payable(msg.sender).transfer(payout);

        emit WinningsClaimed(_marketId, msg.sender, payout);
    }

    // --- Internal & Helper Functions ---
    function deployMarketTokens(
        uint256 _marketId,
        string memory _question
    ) internal returns (address yesToken, address noToken) {
        // Use a concise name and symbol for gas efficiency
        string memory yesName = string(abi.encodePacked("YES: ", _question));
        string memory noName = string(abi.encodePacked("NO: ", _question));
        string memory yesSymbol = string(abi.encodePacked("Y", uintToString(_marketId)));
        string memory noSymbol = string(abi.encodePacked("N", uintToString(_marketId)));
        
        (yesToken, noToken) = marketTokenFactory.createMarketTokens(yesName, yesSymbol, noName, noSymbol);
    }

    function uintToString(uint256 value) internal pure returns (string memory) {
        // Using OpenZeppelin's Strings library is recommended for production
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // --- Admin Functions ---
    function authorizeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = true;
    }

    function revokeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = false;
    }
}