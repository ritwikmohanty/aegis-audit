// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MarketTokens.sol";
import "./IHederaTokenService.sol";

/**
 * @title PredictionMarket
 * @dev A prediction market contract with automated market maker functionality
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    // --- Enums and Structs ---
    enum MarketStatus { Active, Resolved, Cancelled }
    enum MarketOutcome { Pending, Yes, No, Invalid }

    struct Market {
        uint256 id;
        string question;
        string contractToAnalyze;
        address creator;
        uint256 endTime;
        MarketStatus status;
        MarketOutcome outcome;
        
        // HTS Token Addresses
        address yesToken;
        address noToken;

        // AMM pools
        uint256 yesTokenPool;
        uint256 noTokenPool;
        uint256 collateralPool; // Base currency (HBAR) pool
        
        uint256 totalVolume;
        uint256 creationFee;
        uint256 resolutionBond;
        
        address oracle;
        bool oracleReported;
        uint256 reportTime;

        // Market metadata
        bytes32 category;
        uint256 minLiquidity;
        uint256 feeRate; // Fee rate in basis points (e.g., 100 = 1%)
    }

    // State variables
    mapping(uint256 => Market) public markets;
    mapping(address => mapping(uint256 => uint256)) public userShares; // user => marketId => shares
    mapping(address => bool) public authorizedOracles;
    
    uint256 public marketCounter;
    uint256 public constant INITIAL_LIQUIDITY = 1000 * 10**18; // 1000 tokens
    uint256 public constant FEE_DENOMINATOR = 10000; // For basis points calculation
    uint256 public constant MIN_MARKET_DURATION = 1 hours;
    uint256 public constant MAX_MARKET_DURATION = 365 days;
    
    address public feeRecipient;
    uint256 public platformFeeRate = 100; // 1% platform fee

    // HTS Integration
    MarketTokens public marketTokenFactory;
    address constant HTS_PRECOMPILE_ADDRESS = 0x167;
    IHederaTokenService constant hts = IHederaTokenService(HTS_PRECOMPILE_ADDRESS);

    // Events
    event MarketCreated(uint256 indexed marketId, address indexed creator, string question, uint256 endTime, address yesToken, address noToken);
    event TokensPurchased(uint256 indexed marketId, address indexed buyer, bool isYesToken, uint256 amount, uint256 cost, uint256 newPrice);
    event MarketResolved(uint256 indexed marketId, MarketOutcome outcome, address indexed oracle);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    // --- Constructor ---
    constructor(address _feeRecipient, address _marketTokenFactory) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        marketCounter = 0;
        marketTokenFactory = MarketTokens(_marketTokenFactory);
    }

    /**
     * @dev Create a new prediction market
     * @param _question The question for the prediction market
     * @param _contractToAnalyze The contract to analyze for the prediction
     * @param _endTime The end time for the market (timestamp)
     * @param _oracle The oracle address for market resolution
     * @param _category The category of the market
     * @param _minLiquidity Minimum liquidity required
     */
    function createMarket(
        string memory _question,
        string memory _contractToAnalyze,
        uint256 _endTime,
        address _oracle,
        bytes32 _category,
        uint256 _minLiquidity
    ) external payable nonReentrant returns (uint256) {
        require(_endTime > block.timestamp + MIN_MARKET_DURATION, "Market duration too short");
        require(_endTime <= block.timestamp + MAX_MARKET_DURATION, "Market duration too long");
        require(authorizedOracles[_oracle], "Unauthorized oracle");
        require(msg.value >= _minLiquidity, "Insufficient initial liquidity");

        uint256 marketId = marketCounter++;
        
        // Deploy YES and NO tokens via Hedera Token Service integration
        (address yesToken, address noToken) = deployMarketTokens(marketId, _question);
        
        markets[marketId] = Market({
            id: marketId,
            question: _question,
            contractToAnalyze: _contractToAnalyze,
            creator: msg.sender,
            endTime: _endTime,
            status: MarketStatus.Active,
            outcome: MarketOutcome.Pending,
            yesToken: yesToken,
            noToken: noToken,
            yesTokenPool: INITIAL_LIQUIDITY,
            noTokenPool: INITIAL_LIQUIDITY,
            collateralPool: msg.value,
            totalVolume: 0,
            creationFee: (msg.value * platformFeeRate) / FEE_DENOMINATOR,
            resolutionBond: 0,
            oracle: _oracle,
            oracleReported: false,
            reportTime: 0,
            category: _category,
            minLiquidity: _minLiquidity,
            feeRate: 300 // 3% default fee rate
        });

        // Associate this contract with the new tokens to allow minting/burning
        hts.associateToken(address(this), yesToken);
        hts.associateToken(address(this), noToken);

        emit MarketCreated(
            marketId,
            msg.sender,
            _question,
            _endTime,
            yesToken,
            noToken
        );

        return marketId;
    }

    /**
     * @dev Deploy YES and NO tokens for a market (Hedera Token Service integration)
     * This is a placeholder for actual HTS integration
     */
    function deployMarketTokens(
        uint256 _marketId,
        string memory _question
    ) internal returns (address yesToken, address noToken) {
        string memory yesName = string(abi.encodePacked("YES-", _question));
        string memory noName = string(abi.encodePacked("NO-", _question));
        string memory yesSymbol = string(abi.encodePacked("YES", uintToString(_marketId)));
        string memory noSymbol = string(abi.encodePacked("NO", uintToString(_marketId)));
        
        (yesToken, noToken) = marketTokenFactory.createMarketTokens(yesName, yesSymbol, noName, noSymbol);
    }

    /**
     * @dev Buy prediction tokens using Automated Market Maker formula
     * @param _marketId The market ID
     * @param _isYesToken True if buying YES tokens, false for NO tokens
     * @param _amount Amount of tokens to buy
     */
    function buyTokens(
        uint256 _marketId,
        bool _isYesToken,
        uint256 _amount
    ) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Active, "Market not active");
        require(block.timestamp < market.endTime, "Market has ended");
        require(_amount > 0, "Invalid amount");

        // Calculate cost using AMM formula (constant product)
        uint256 cost = calculateTokenCost(_marketId, _isYesToken, _amount);
        require(msg.value >= cost, "Insufficient payment");

        // Associate buyer with the token if they haven't already
        address tokenToBuy = _isYesToken ? market.yesToken : market.noToken;
        hts.associateToken(msg.sender, tokenToBuy);

        // Update token pools
        if (_isYesToken) {
            market.yesTokenPool = market.yesTokenPool + _amount;
        } else {
            market.noTokenPool = market.noTokenPool + _amount;
        }
        
        market.collateralPool = market.collateralPool + msg.value;
        market.totalVolume = market.totalVolume + msg.value;

        // Mint tokens to buyer via HTS
        (int response, , ) = hts.mintToken(tokenToBuy, _amount, new bytes[](0));
        require(response == 22, "HTS mint failed");

        // Calculate new price after trade
        uint256 newPrice = getTokenPrice(_marketId, _isYesToken);

        emit TokensPurchased(_marketId, msg.sender, _isYesToken, _amount, cost, newPrice);

        // Refund excess payment
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
    }

    /**
     * @dev Calculate the cost to buy tokens using AMM formula
     * @param _marketId The market ID
     * @param _isYesToken True if YES token, false if NO token
     * @param _amount The amount of tokens to buy
     * @return cost The cost in collateral (ETH)
     */
    function calculateTokenCost(
        uint256 _marketId,
        bool _isYesToken,
        uint256 _amount
    ) public view returns (uint256) {
        Market storage market = markets[_marketId];
        
        uint256 currentPool = _isYesToken ? market.yesTokenPool : market.noTokenPool;
        uint256 otherPool = _isYesToken ? market.noTokenPool : market.yesTokenPool;
        
        // Constant product formula: k = x * y
        uint256 k = currentPool * otherPool;
        
        // New pool after adding tokens
        uint256 newCurrentPool = currentPool + _amount;
        
        // Calculate required collateral change based on preserving k
        uint256 newOtherPool = k / newCurrentPool;
        uint256 collateralRequired = otherPool - newOtherPool;
        
        // Add fee
        uint256 fee = (collateralRequired * market.feeRate) / FEE_DENOMINATOR;
        
        return collateralRequired + fee;
    }

    /**
     * @dev Get current token price
     */
    function getTokenPrice(uint256 _marketId, bool _isYesToken) public view returns (uint256) {
        Market storage market = markets[_marketId];
        
        if (_isYesToken) {
            return (market.collateralPool * 10**18) / market.yesTokenPool;
        } else {
            return (market.collateralPool * 10**18) / market.noTokenPool;
        }
    }

    function reportOutcome(uint256 _marketId, MarketOutcome _outcome) external {
        Market storage market = markets[_marketId];
        require(msg.sender == market.oracle, "Only authorized oracle");
        require(market.status == MarketStatus.Active, "Market not active");
        require(block.timestamp >= market.endTime, "Market not yet ended");
        require(!market.oracleReported, "Already reported");
        require(_outcome == MarketOutcome.Yes || _outcome == MarketOutcome.No || _outcome == MarketOutcome.Invalid, "Invalid outcome");

        market.oracleReported = true;
        market.reportTime = block.timestamp;
        market.outcome = _outcome;
        market.status = MarketStatus.Resolved;

        emit MarketResolved(_marketId, _outcome, msg.sender);
    }

    /**
     * @dev Claim winnings from a resolved market. User must have transferred winning tokens to this contract first.
     * @param _marketId Market identifier
     * @param _amountToBurn The amount of winning tokens the user has transferred to this contract to burn.
     */
    function claimWinnings(uint256 _marketId, uint256 _amountToBurn) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Resolved, "Market not resolved");
        require(_amountToBurn > 0, "Must burn more than 0 tokens");

        address winningToken;
        uint256 totalWinningTokens;
        if (market.outcome == MarketOutcome.Yes) {
            winningToken = market.yesToken;
            totalWinningTokens = market.yesTokenPool;
        } else if (market.outcome == MarketOutcome.No) {
            winningToken = market.noToken;
            totalWinningTokens = market.noTokenPool;
        } else {
            revert("Market outcome is invalid, use handleInvalidOutcome");
        }

        // Calculate user's share of the payout
        uint256 totalPayout = market.collateralPool;
        uint256 userPayout = (totalPayout * _amountToBurn) / totalWinningTokens;

        // Burn user's tokens via HTS. The tokens must have been transferred to this contract.
        (int response, ) = hts.burnToken(winningToken, _amountToBurn, new int64[](0));
        require(response == 22, "HTS burn failed. Ensure tokens were transferred to this contract.");

        // Reduce the collateral pool by the amount paid out
        market.collateralPool -= userPayout;

        // Transfer payout
        payable(msg.sender).transfer(userPayout);

        emit WinningsClaimed(_marketId, msg.sender, userPayout);
    }

    /**
     * @dev Handle invalid outcome by returning proportional shares
     * @param _marketId Market identifier
     */
    function handleInvalidOutcome(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Resolved, "Market not resolved");
        require(market.outcome == MarketOutcome.Invalid, "Not an invalid outcome market");

        // Logic to return proportional shares to users
        // This would require a separate claiming mechanism for invalid outcomes
        // Users would burn their tokens to receive: (userTokens / totalTokens) * totalPayout
    }

    /**
     * @dev Add authorization for an oracle
     * @param _oracle Oracle address to authorize
     */
    function authorizeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = true;
    }

    /**
     * @dev Revoke authorization for an oracle
     * @param _oracle Oracle address to revoke
     */
    function revokeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = false;
    }

    /**
     * @dev Cancel a market and refund users
     * @param _marketId Market identifier
     */
    function cancelMarket(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(msg.sender == market.creator, "Only creator can cancel");
        require(market.status == MarketStatus.Active, "Market not active");

        market.status = MarketStatus.Cancelled;
        
        // In a cancelled market, users should be able to claim refunds
        // Implementation would return their initial investments
    }

    /**
     * @dev Helper to convert uint to string
     */
    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}