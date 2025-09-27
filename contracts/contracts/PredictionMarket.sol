// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
Use Standard Math Operators
Find all the places where you used SafeMath functions (like .add(), .sub(), .mul()) and replace them with the standard Solidity operators (+, -, *).

Before:

Solidity

uint256 a = 5;
uint256 b = 10;
uint256 c = a.add(b); // Using SafeMath
After:

Solidity

uint256 a = 5;
uint256 b = 10;
uint256 c = a + b; // Using standard math

/**
 * @title PredictionMarket
 * @dev A prediction market contract with automated market maker functionality
 * Integrates with Hedera Token Service for YES/NO token deployment
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Market status enum
    enum MarketStatus {
        Active,
        Resolved,
        Cancelled
    }

    // Market outcome enum
    enum MarketOutcome {
        Pending,
        Yes,
        No,
        Invalid
    }

    // Market struct definition
    struct Market {
        uint256 id;
        string question;
        string contractToAnalyze; // Contract address or identifier to be analyzed
        address creator;
        uint256 endTime;
        MarketStatus status;
        MarketOutcome outcome;
        
        // Token addresses for YES/NO tokens
        address yesToken;
        address noToken;
        
        // Token pools for AMM
        uint256 yesTokenPool;
        uint256 noTokenPool;
        uint256 liquidityPool; // Base currency pool
        
        // Market parameters
        uint256 totalVolume;
        uint256 creationFee;
        uint256 resolutionBond;
        
        // Oracle and resolution
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

    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        string contractToAnalyze,
        uint256 endTime,
        address yesToken,
        address noToken
    );
    
    event TokensPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        bool isYesToken,
        uint256 amount,
        uint256 cost,
        uint256 newPrice
    );
    
    event MarketResolved(
        uint256 indexed marketId,
        MarketOutcome outcome,
        address indexed oracle
    );
    
    event LiquidityAdded(
        uint256 indexed marketId,
        address indexed provider,
        uint256 amount
    );
    
    event RewardsDistributed(
        uint256 indexed marketId,
        address indexed winner,
        uint256 amount
    );

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
        marketCounter = 0;
    }

    /**
     * @dev Create a new prediction market
     * @param _question The market question
     * @param _contractToAnalyze The contract to be analyzed
     * @param _endTime When the market ends
     * @param _category Market category
     * @param _oracle Oracle address for this market
     * @param _minLiquidity Minimum liquidity required
     */
    function createMarket(
        string memory _question,
        string memory _contractToAnalyze,
        uint256 _endTime,
        bytes32 _category,
        address _oracle,
        uint256 _minLiquidity
    ) external payable nonReentrant returns (uint256) {
        require(_endTime > block.timestamp + MIN_MARKET_DURATION, "Market duration too short");
        require(_endTime < block.timestamp + MAX_MARKET_DURATION, "Market duration too long");
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
            liquidityPool: msg.value,
            totalVolume: 0,
            creationFee: msg.value.mul(platformFeeRate).div(FEE_DENOMINATOR),
            resolutionBond: 0,
            oracle: _oracle,
            oracleReported: false,
            reportTime: 0,
            category: _category,
            minLiquidity: _minLiquidity,
            feeRate: 300 // 3% default fee rate
        });

        emit MarketCreated(
            marketId,
            msg.sender,
            _question,
            _contractToAnalyze,
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
        // In actual implementation, this would integrate with Hedera Token Service
        // For now, we'll create ERC20 tokens as placeholders
        
        string memory yesName = string(abi.encodePacked("YES-", _question));
        string memory noName = string(abi.encodePacked("NO-", _question));
        
        yesToken = address(new MarketToken(yesName, "YES", _marketId));
        noToken = address(new MarketToken(noName, "NO", _marketId));
    }

    /**
     * @dev Buy prediction tokens using Automated Market Maker formula
     * @param _marketId Market identifier
     * @param _isYesToken True for YES token, false for NO token
     * @param _amount Amount of tokens to buy
     */
    function buyTokens(
        uint256 _marketId,
        bool _isYesToken,
        uint256 _amount
    ) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Active, "Market not active");
        require(block.timestamp < market.endTime, "Market expired");
        require(_amount > 0, "Invalid amount");

        // Calculate cost using AMM formula (constant product)
        uint256 cost = calculateTokenCost(_marketId, _isYesToken, _amount);
        require(msg.value >= cost, "Insufficient payment");

        // Update token pools
        if (_isYesToken) {
            market.yesTokenPool = market.yesTokenPool.add(_amount);
        } else {
            market.noTokenPool = market.noTokenPool.add(_amount);
        }
        
        market.liquidityPool = market.liquidityPool.add(msg.value);
        market.totalVolume = market.totalVolume.add(msg.value);

        // Mint tokens to buyer
        MarketToken token = MarketToken(_isYesToken ? market.yesToken : market.noToken);
        token.mint(msg.sender, _amount);

        // Calculate new price after trade
        uint256 newPrice = getTokenPrice(_marketId, _isYesToken);

        emit TokensPurchased(_marketId, msg.sender, _isYesToken, _amount, cost, newPrice);

        // Refund excess payment
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value.sub(cost));
        }
    }

    /**
     * @dev Calculate the cost to buy tokens using AMM formula
     * Uses constant product market maker: x * y = k
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
        uint256 k = currentPool.mul(otherPool);
        
        // New pool after adding tokens
        uint256 newCurrentPool = currentPool.add(_amount);
        
        // Calculate required liquidity change
        uint256 newOtherPool = k.div(newCurrentPool);
        uint256 liquidityRequired = otherPool.sub(newOtherPool);
        
        // Add fee
        uint256 fee = liquidityRequired.mul(market.feeRate).div(FEE_DENOMINATOR);
        
        return liquidityRequired.add(fee);
    }

    /**
     * @dev Get current token price
     */
    function getTokenPrice(uint256 _marketId, bool _isYesToken) public view returns (uint256) {
        Market storage market = markets[_marketId];
        
        if (_isYesToken) {
            return market.liquidityPool.mul(10**18).div(market.yesTokenPool);
        } else {
            return market.liquidityPool.mul(10**18).div(market.noTokenPool);
        }
    }

    /**
     * @dev Oracle reports the market outcome
     * @param _marketId Market identifier
     * @param _outcome The reported outcome
     */
    function reportOutcome(
        uint256 _marketId,
        MarketOutcome _outcome
    ) external {
        Market storage market = markets[_marketId];
        require(msg.sender == market.oracle, "Only authorized oracle");
        require(market.status == MarketStatus.Active, "Market not active");
        require(block.timestamp >= market.endTime, "Market not yet ended");
        require(!market.oracleReported, "Already reported");
        require(_outcome != MarketOutcome.Pending, "Invalid outcome");

        market.oracleReported = true;
        market.reportTime = block.timestamp;
        market.outcome = _outcome;
        market.status = MarketStatus.Resolved;

        emit MarketResolved(_marketId, _outcome, msg.sender);
    }

    /**
     * @dev Settle market and distribute rewards
     * @param _marketId Market identifier
     */
    function settleMarket(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Resolved, "Market not resolved");
        require(market.outcome != MarketOutcome.Pending, "Invalid outcome");

        address winningToken;
        uint256 winningPool;
        
        if (market.outcome == MarketOutcome.Yes) {
            winningToken = market.yesToken;
            winningPool = market.yesTokenPool;
        } else if (market.outcome == MarketOutcome.No) {
            winningToken = market.noToken;
            winningPool = market.noTokenPool;
        } else {
            // Invalid outcome - return proportional shares
            _handleInvalidOutcome(_marketId);
            return;
        }

        // Calculate total payout pool
        uint256 totalPayout = market.liquidityPool;
        uint256 platformFee = totalPayout.mul(platformFeeRate).div(FEE_DENOMINATOR);
        uint256 userPayout = totalPayout.sub(platformFee);

        // Transfer platform fee
        payable(feeRecipient).transfer(platformFee);

        // Users need to claim their winnings separately
        market.liquidityPool = userPayout; // Store available payout
    }

    /**
     * @dev Claim winnings from a settled market
     * @param _marketId Market identifier
     */
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Resolved, "Market not resolved");

        address winningToken;
        if (market.outcome == MarketOutcome.Yes) {
            winningToken = market.yesToken;
        } else if (market.outcome == MarketOutcome.No) {
            winningToken = market.noToken;
        } else {
            revert("Invalid outcome for claiming");
        }

        MarketToken token = MarketToken(winningToken);
        uint256 userTokens = token.balanceOf(msg.sender);
        require(userTokens > 0, "No winning tokens");

        // Calculate user's share of the payout
        uint256 totalWinningTokens = token.totalSupply();
        uint256 userPayout = market.liquidityPool.mul(userTokens).div(totalWinningTokens);

        // Burn user's tokens
        token.burnFrom(msg.sender, userTokens);

        // Transfer payout
        payable(msg.sender).transfer(userPayout);

        emit RewardsDistributed(_marketId, msg.sender, userPayout);
    }

    /**
     * @dev Handle invalid outcome by returning proportional shares
     */
    function _handleInvalidOutcome(uint256 _marketId) internal {
        Market storage market = markets[_marketId];
        
        // In case of invalid outcome, users can claim proportional refunds
        // Implementation would allow users to burn their tokens for proportional ETH
        
        uint256 totalTokens = market.yesTokenPool.add(market.noTokenPool);
        uint256 totalPayout = market.liquidityPool;
        
        // This would require a separate claiming mechanism for invalid outcomes
        // Users would burn their tokens to receive: (userTokens / totalTokens) * totalPayout
    }

    /**
     * @dev Add authorization for an oracle
     */
    function authorizeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = true;
    }

    /**
     * @dev Remove authorization for an oracle
     */
    function revokeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = false;
    }

    /**
     * @dev Update platform fee rate
     */
    function setPlatformFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 1000, "Fee rate too high"); // Max 10%
        platformFeeRate = _feeRate;
    }

    /**
     * @dev Get market information
     */
    function getMarket(uint256 _marketId) external view returns (Market memory) {
        return markets[_marketId];
    }

    /**
     * @dev Get market prices for both tokens
     */
    function getMarketPrices(uint256 _marketId) external view returns (uint256 yesPrice, uint256 noPrice) {
        yesPrice = getTokenPrice(_marketId, true);
        noPrice = getTokenPrice(_marketId, false);
    }

    /**
     * @dev Emergency function to cancel a market (only owner)
     */
    function cancelMarket(uint256 _marketId) external onlyOwner {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Active, "Market not active");
        
        market.status = MarketStatus.Cancelled;
        
        // In a cancelled market, users should be able to claim refunds
        // Implementation would return their initial investments
    }
}

/**
 * @title MarketToken
 * @dev ERC20 token for market predictions (YES/NO tokens)
 * In production, this would integrate with Hedera Token Service
 */
contract MarketToken is ERC20 {
    address public predictionMarket;
    uint256 public marketId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _marketId
    ) ERC20(_name, _symbol) {
        predictionMarket = msg.sender;
        marketId = _marketId;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == predictionMarket, "Only prediction market can mint");
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external {
        require(msg.sender == predictionMarket, "Only prediction market can burn");
        _burn(from, amount);
    }
}