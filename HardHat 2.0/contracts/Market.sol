// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MarketTokens.sol";
import "./IHederaTokenService.sol";

/**
 * @title Market
 * @dev Manages the logic for a single prediction market. Deployed by MarketFactory.
 */
contract Market is Ownable, ReentrancyGuard {
    // --- Structs and Enums ---
    struct MarketInfo {
        string question;
        uint256 endTime;
        address oracle;
        uint256 totalYesShares;
        uint256 totalNoShares;
        uint256 totalCollateral;
        address yesTokenAddress;
        address noTokenAddress;
        Outcome outcome;
        bool isResolved;
        // AI Analysis Integration Fields
        address contractToAnalyze;
        string contractHash;
        bytes32 analysisReportHash;
        uint256 confidenceScore; // Confidence score from AI (0-10000 basis points)
        uint256 createdAt;
    }

    enum Outcome { PENDING, YES, NO, INVALID }

    // --- State Variables ---
    MarketInfo public marketInfo;
    MarketTokens public immutable marketTokenManager;

    mapping(address => uint256) public yesShares;
    mapping(address => uint256) public noShares;
    
    // AMM constants
    uint256 public constant INITIAL_LIQUIDITY = 1000 * 10**18; // 1000 tokens initial liquidity
    uint256 public constant FEE_RATE = 30; // 0.3% fee (30 basis points)
    uint256 public constant BASIS_POINTS = 10000;

    address constant HTS_PRECOMPILE_ADDRESS = address(0x167);
    IHederaTokenService constant hts = IHederaTokenService(HTS_PRECOMPILE_ADDRESS);

    // --- Events ---
    event TokensPurchased(address indexed user, bool indexed isYesToken, uint256 amount, uint256 cost);
    event MarketResolved(Outcome outcome);
    event WinningsClaimed(address indexed user, uint256 amount);

    // --- Modifiers ---
    modifier marketNotResolved() {
        require(!marketInfo.isResolved, "Market is already resolved");
        _;
    }

    modifier marketResolved() {
        require(marketInfo.isResolved, "Market is not resolved");
        _;
    }
    
    modifier marketNotExpired() {
        require(block.timestamp < marketInfo.endTime, "Market has expired");
        _;
    }

    // --- Constructor ---
    constructor(
        string memory _question,
        uint256 _endTime,
        address _oracle,
        address _marketTokenManager,
        address _yesTokenAddress,
        address _noTokenAddress,
        address _factoryAddress, // The factory address will be the initial owner
        address _contractToAnalyze,
        string memory _contractHash,
        uint256 _confidenceScore
    ) Ownable(_factoryAddress) {
        require(_endTime > block.timestamp, "End time must be in the future");
        require(_oracle != address(0), "Oracle address cannot be zero");
        require(_confidenceScore <= 10000, "Confidence score must be <= 10000");
        
        marketInfo.question = _question;
        marketInfo.endTime = _endTime;
        marketInfo.oracle = _oracle;
        marketInfo.yesTokenAddress = _yesTokenAddress;
        marketInfo.noTokenAddress = _noTokenAddress;
        marketInfo.contractToAnalyze = _contractToAnalyze;
        marketInfo.contractHash = _contractHash;
        marketInfo.confidenceScore = _confidenceScore;
        marketInfo.createdAt = block.timestamp;
        marketTokenManager = MarketTokens(_marketTokenManager);
    }
    
    /**
     * @dev Allows a user to buy YES or NO tokens using AMM pricing.
     */
    function buyTokens(bool _isYesToken, uint256 _amountToReceive) external payable nonReentrant marketNotResolved marketNotExpired {
        require(msg.value > 0, "Must send HBAR to buy tokens");
        require(_amountToReceive > 0, "Amount must be greater than 0");

        // Calculate the price using AMM formula
        uint256 totalCost = calculateTokenPrice(_isYesToken, _amountToReceive);
        require(msg.value >= totalCost, "Insufficient payment for tokens");

        address tokenToMint = _isYesToken ? marketInfo.yesTokenAddress : marketInfo.noTokenAddress;
        
        // FIX: Explicitly cast _amountToReceive to uint64 for HTS compatibility.
        // FIX: Correctly handle the 3 return values from mintToken.
        (int response, , ) = hts.mintToken(tokenToMint, uint64(_amountToReceive), new bytes[](0));
        require(response == 22, "HTS mint failed");

        if (_isYesToken) {
            yesShares[msg.sender] += _amountToReceive;
            marketInfo.totalYesShares += _amountToReceive;
        } else {
            noShares[msg.sender] += _amountToReceive;
            marketInfo.totalNoShares += _amountToReceive;
        }

        marketInfo.totalCollateral += totalCost;
        
        // Refund excess payment
        if (msg.value > totalCost) {
            (bool success, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(success, "Refund failed");
        }

        emit TokensPurchased(msg.sender, _isYesToken, _amountToReceive, totalCost);
    }

    /**
     * @dev Called by the authorized oracle to resolve the market.
     */
    function reportOutcome(uint _outcome) external marketNotResolved {
        Outcome outcomeToSet = Outcome(_outcome);
        require(msg.sender == marketInfo.oracle, "Only the oracle can report the outcome");
        require(outcomeToSet != Outcome.PENDING, "Invalid outcome");
        
        marketInfo.outcome = outcomeToSet;
        marketInfo.isResolved = true;
        
        emit MarketResolved(outcomeToSet);
    }
    
    /**
     * @dev Sets the analysis report hash after AI analysis is complete.
     */
    function setAnalysisReportHash(bytes32 _reportHash) external {
        require(msg.sender == marketInfo.oracle, "Only oracle can set report hash");
        require(marketInfo.analysisReportHash == bytes32(0), "Report hash already set");
        marketInfo.analysisReportHash = _reportHash;
    }
    
    /**
     * @dev Allows anyone to resolve an expired market as INVALID.
     */
    function resolveExpiredMarket() external marketNotResolved {
        require(block.timestamp >= marketInfo.endTime, "Market has not expired yet");
        
        marketInfo.outcome = Outcome.INVALID;
        marketInfo.isResolved = true;
        
        emit MarketResolved(Outcome.INVALID);
    }
    
    /**
     * @dev Emergency function to resolve market as INVALID (owner only).
     */
    function emergencyResolveAsInvalid() external onlyOwner marketNotResolved {
        marketInfo.outcome = Outcome.INVALID;
        marketInfo.isResolved = true;
        
        emit MarketResolved(Outcome.INVALID);
    }

    /**
     * @dev Allows users to claim their winnings after the market is resolved.
     */
    function claimWinnings() external nonReentrant marketResolved {
        uint256 winnings = 0;
        address winningToken = _getWinningTokenAddress();
        
        require(winningToken != address(0), "No winning token for this outcome");

        if (winningToken == marketInfo.yesTokenAddress) {
            uint256 userShares = yesShares[msg.sender];
            require(userShares > 0, "No winning shares to claim");
            winnings = (userShares * marketInfo.totalCollateral) / marketInfo.totalYesShares;
            
            yesShares[msg.sender] = 0;
            _burnTokens(marketInfo.yesTokenAddress, userShares);
            
        } else { // NO token won
            uint256 userShares = noShares[msg.sender];
            require(userShares > 0, "No winning shares to claim");
            winnings = (userShares * marketInfo.totalCollateral) / marketInfo.totalNoShares;
            
            noShares[msg.sender] = 0;
            _burnTokens(marketInfo.noTokenAddress, userShares);
        }

        require(winnings > 0, "Calculated winnings are zero");

        (bool success, ) = msg.sender.call{value: winnings}("");
        require(success, "Transfer failed");

        emit WinningsClaimed(msg.sender, winnings);
    }
    
    // --- AMM Pricing Functions ---
    
    /**
     * @dev Calculates the cost to buy a specific amount of tokens using constant product AMM.
     */
    function calculateTokenPrice(bool _isYesToken, uint256 _amount) public view returns (uint256) {
        uint256 yesPool = marketInfo.totalYesShares + INITIAL_LIQUIDITY;
        uint256 noPool = marketInfo.totalNoShares + INITIAL_LIQUIDITY;
        uint256 totalLiquidity = yesPool + noPool;
        
        uint256 cost;
        if (_isYesToken) {
            // Price based on ratio: more YES tokens = higher price for YES
            cost = (_amount * noPool * totalLiquidity) / (yesPool * (yesPool + _amount));
        } else {
            // Price based on ratio: more NO tokens = higher price for NO
            cost = (_amount * yesPool * totalLiquidity) / (noPool * (noPool + _amount));
        }
        
        // Add trading fee
        uint256 fee = (cost * FEE_RATE) / BASIS_POINTS;
        return cost + fee;
    }
    
    /**
     * @dev Gets the current price for 1 token (in wei).
     */
    function getCurrentTokenPrice(bool _isYesToken) external view returns (uint256) {
        return calculateTokenPrice(_isYesToken, 1 * 10**18);
    }
    
    /**
     * @dev Gets the current probability/odds for YES outcome (returns percentage * 100).
     */
    function getCurrentOdds() external view returns (uint256 yesOdds, uint256 noOdds) {
        uint256 yesPool = marketInfo.totalYesShares + INITIAL_LIQUIDITY;
        uint256 noPool = marketInfo.totalNoShares + INITIAL_LIQUIDITY;
        uint256 totalPool = yesPool + noPool;
        
        yesOdds = (noPool * 10000) / totalPool; // Percentage * 100
        noOdds = (yesPool * 10000) / totalPool;
    }

    // --- Internal & Private Functions ---
    
    function _burnTokens(address tokenAddress, uint256 amount) internal {
        // This simple burn assumes the contract has wipe key and user has tokens.
        // A full implementation would require approvals and transfers.
        // FIX: Explicitly cast amount to uint64 for HTS compatibility.
        (int response, ) = hts.burnToken(tokenAddress, uint64(amount), new int64[](0));
        require(response == 22, "HTS burn failed");
    }

    function _getWinningTokenAddress() private view returns (address) {
        if (marketInfo.outcome == Outcome.YES) {
            return marketInfo.yesTokenAddress;
        }
        if (marketInfo.outcome == Outcome.NO) {
            return marketInfo.noTokenAddress;
        }
        return address(0); // For INVALID outcome
    }
}

