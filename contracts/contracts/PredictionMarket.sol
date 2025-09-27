// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// IMPROVEMENT: Import ERC1155 and the new MarketTokens contract
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MarketTokens.sol"; // Assuming MarketTokens.sol is in the same directory

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
        
        // IMPROVEMENT: AMM pools tracking token supply within the contract
        uint256 yesTokenSupply;
        uint256 noTokenSupply;
        uint256 collateralPool; // Base currency (ETH) pool
        
        address oracle;
        bool oracleReported;
        // Other fields like category, fees etc. can be added back as needed
    }

    // --- State Variables ---
    MarketTokens public marketTokens; // IMPROVEMENT: Single ERC1155 contract instance

    mapping(uint256 => Market) public markets;
    mapping(address => bool) public authorizedOracles;
    
    uint256 public marketCounter;
    uint256 public platformFeeRate = 100; // 1% platform fee in basis points (100 = 1%)
    address public feeRecipient;

    // --- Events ---
    event MarketCreated(uint256 indexed marketId, address indexed creator, string question, uint256 endTime);
    event TokensPurchased(uint256 indexed marketId, address indexed buyer, bool isYesToken, uint256 amountSpent, uint256 tokensReceived);
    event MarketResolved(uint256 indexed marketId, MarketOutcome outcome, address indexed oracle);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    // --- Constructor ---
    constructor(address _feeRecipient) Ownable(msg.sender) {
        // IMPROVEMENT: Deploy a single MarketTokens contract and store its address.
        marketTokens = new MarketTokens(address(this));
        feeRecipient = _feeRecipient;
    }

    // --- Core Functions ---

    function createMarket(
        string memory _question,
        string memory _contractToAnalyze,
        uint256 _endTime,
        address _oracle
    ) external payable returns (uint256) {
        require(_endTime > block.timestamp, "End time must be in the future");
        require(authorizedOracles[_oracle], "Unauthorized oracle");
        require(msg.value > 0, "Initial collateral required");

        uint256 marketId = marketCounter++;
        
        // IMPROVEMENT: The creator provides initial collateral.
        // The contract mints an equal number of YES and NO tokens to itself to seed the AMM.
        uint256 initialCollateral = msg.value;
        uint256 initialSupply = initialCollateral; // 1 wei of collateral = 1 token share

        markets[marketId] = Market({
            id: marketId,
            question: _question,
            contractToAnalyze: _contractToAnalyze,
            creator: msg.sender,
            endTime: _endTime,
            status: MarketStatus.Active,
            outcome: MarketOutcome.Pending,
            yesTokenSupply: initialSupply,
            noTokenSupply: initialSupply,
            collateralPool: initialCollateral,
            oracle: _oracle,
            oracleReported: false
        });

        // Mint initial sets of tokens to this contract to provide liquidity
        uint256 yesTokenId = _getYesTokenId(marketId);
        uint256 noTokenId = _getNoTokenId(marketId);
        marketTokens.mint(address(this), yesTokenId, initialSupply, "");
        marketTokens.mint(address(this), noTokenId, initialSupply, "");

        emit MarketCreated(marketId, msg.sender, _question, _endTime);
        return marketId;
    }

    function buyTokens(uint256 _marketId, bool _isYesToken) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Active, "Market not active");
        require(block.timestamp < market.endTime, "Market has ended");
        require(msg.value > 0, "Must send ETH to buy");

        // FIX: Correct AMM cost calculation (constant product: x * y = k)
        uint256 k = market.yesTokenSupply * market.noTokenSupply;
        
        uint256 inputPool;
        uint256 outputPool;

        if (_isYesToken) {
            inputPool = market.noTokenSupply;
            outputPool = market.yesTokenSupply;
        } else {
            inputPool = market.yesTokenSupply;
            outputPool = market.noTokenSupply;
        }

        // Formula: tokensOut = (outputPool * amountIn) / (inputPool + amountIn)
        uint256 amountIn = msg.value;
        uint256 tokensOut = (outputPool * amountIn) / (inputPool + amountIn);
        require(tokensOut > 0, "Zero tokens received");

        // Update market state
        market.collateralPool += amountIn;
        if (_isYesToken) {
            market.yesTokenSupply -= tokensOut;
            market.noTokenSupply += tokensOut;
        } else {
            market.noTokenSupply -= tokensOut;
            market.yesTokenSupply += tokensOut;
        }

        // Transfer tokens to the buyer
        uint256 tokenId = _isYesToken ? _getYesTokenId(_marketId) : _getNoTokenId(_marketId);
        marketTokens.mint(msg.sender, tokenId, tokensOut, "");
        
        emit TokensPurchased(_marketId, msg.sender, _isYesToken, amountIn, tokensOut);
    }


    function reportOutcome(uint256 _marketId, MarketOutcome _outcome) external {
        Market storage market = markets[_marketId];
        require(msg.sender == market.oracle, "Only authorized oracle");
        require(market.status == MarketStatus.Active, "Market not active");
        require(block.timestamp >= market.endTime, "Market not yet ended");
        require(!market.oracleReported, "Already reported");
        require(_outcome == MarketOutcome.Yes || _outcome == MarketOutcome.No || _outcome == MarketOutcome.Invalid, "Invalid outcome");

        market.oracleReported = true;
        market.outcome = _outcome;
        market.status = MarketStatus.Resolved;

        emit MarketResolved(_marketId, _outcome, msg.sender);
    }

    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Resolved, "Market not resolved");

        uint256 winningTokenId;
        if (market.outcome == MarketOutcome.Yes) {
            winningTokenId = _getYesTokenId(_marketId);
        } else if (market.outcome == MarketOutcome.No) {
            winningTokenId = _getNoTokenId(_marketId);
        } else {
            revert("Market outcome invalid, cannot claim");
        }

        uint256 userTokens = marketTokens.balanceOf(msg.sender, winningTokenId);
        require(userTokens > 0, "No winning tokens to claim");

        // FIX: Correctly calculate total supply from the market struct
        uint256 totalWinningTokens = market.yesTokenSupply + market.noTokenSupply;
        uint256 userPayout = (market.collateralPool * userTokens) / totalWinningTokens;

        // FIX: Update state BEFORE transfer (Checks-Effects-Interactions)
        market.collateralPool -= userPayout;
        
        // Burn user's tokens to prevent double-claiming
        marketTokens.burn(msg.sender, winningTokenId, userTokens);

        // Transfer payout
        payable(msg.sender).transfer(userPayout);

        emit WinningsClaimed(_marketId, msg.sender, userPayout);
    }


    // --- Admin Functions ---
    function authorizeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = true;
    }

    function revokeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = false;
    }

    // --- View Functions ---
    function getMarket(uint256 _marketId) external view returns (Market memory) {
        return markets[_marketId];
    }

    // --- Internal Helper Functions ---
    function _getYesTokenId(uint256 _marketId) internal pure returns (uint256) {
        return _marketId * 2;
    }

    function _getNoTokenId(uint256 _marketId) internal pure returns (uint256) {
        return (_marketId * 2) + 1;
    }
}