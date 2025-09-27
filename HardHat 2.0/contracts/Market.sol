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
    }

    enum Outcome { PENDING, YES, NO, INVALID }

    // --- State Variables ---
    MarketInfo public marketInfo;
    MarketTokens public immutable marketTokenManager;

    mapping(address => uint256) public yesShares;
    mapping(address => uint256) public noShares;

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

    // --- Constructor ---
    constructor(
        string memory _question,
        uint256 _endTime,
        address _oracle,
        address _marketTokenManager,
        address _yesTokenAddress,
        address _noTokenAddress,
        address _factoryAddress // The factory address will be the initial owner
    ) Ownable(_factoryAddress) {
        marketInfo.question = _question;
        marketInfo.endTime = _endTime;
        marketInfo.oracle = _oracle;
        marketInfo.yesTokenAddress = _yesTokenAddress;
        marketInfo.noTokenAddress = _noTokenAddress;
        marketTokenManager = MarketTokens(_marketTokenManager);
    }
    
    /**
     * @dev Allows a user to buy YES or NO tokens.
     */
    function buyTokens(bool _isYesToken, uint256 _amountToReceive) external payable nonReentrant marketNotResolved {
        require(msg.value > 0, "Must send HBAR to buy tokens");
        // For simplicity, 1 tinybar = 1 token share. A real AMM would be more complex.
        require(_amountToReceive == msg.value, "Payment must match token amount");

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

        marketInfo.totalCollateral += msg.value;
        emit TokensPurchased(msg.sender, _isYesToken, _amountToReceive, msg.value);
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

