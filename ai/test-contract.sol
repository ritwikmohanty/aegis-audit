// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableContract {
    mapping(address => uint256) public balances;
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    // Vulnerability: Reentrancy attack possible
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // External call before state change (reentrancy vulnerability)
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        balances[msg.sender] -= amount;
    }
    
    // Vulnerability: No access control
    function emergencyWithdraw() public {
        payable(msg.sender).transfer(address(this).balance);
    }
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    // Vulnerability: Integer overflow (in older Solidity versions)
    function unsafeAdd(uint256 a, uint256 b) public pure returns (uint256) {
        return a + b; // Could overflow in Solidity < 0.8.0
    }
}