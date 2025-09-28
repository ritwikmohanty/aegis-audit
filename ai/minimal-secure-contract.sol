// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MinimalSecureContract
 * @dev A minimal secure smart contract with basic functionality and no vulnerabilities
 */
contract MinimalSecureContract {
    
    // State variables
    mapping(address => uint256) private balances;
    address private immutable owner;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    
    // Custom errors
    error InsufficientBalance();
    error InvalidAmount();
    error OnlyOwner();
    
    // Modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Simple deposit function
     */
    function deposit() external payable {
        if (msg.value == 0) revert InvalidAmount();
        
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
    
    /**
     * @dev Simple withdrawal function with proper checks
     */
    function withdraw(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        
        // Update state first
        balances[msg.sender] -= amount;
        
        // Emit event
        emit Withdrawal(msg.sender, amount);
        
        // Transfer last
        payable(msg.sender).transfer(amount);
    }
    
    /**
     * @dev Get balance of a user
     */
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
    
    /**
     * @dev Get contract balance (only owner)
     */
    function getContractBalance() external view onlyOwner returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get owner address
     */
    function getOwner() external view returns (address) {
        return owner;
    }
}