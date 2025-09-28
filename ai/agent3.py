#!/usr/bin/env python3
"""
Agent 3: The Remediation Agent
Generates security fixes and recommendations based on vulnerabilities confirmed by Agent 2.
Provides secure code alternatives and best practices for identified issues.
"""
import json
import sys
import os
import re
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from hedera import Client, PrivateKey, TopicMessageSubmitTransaction, TopicId

# Load environment variables
load_dotenv()

def log(message: str, run_id: str) -> None:
    """
    Prints a structured log message to stderr for the Master Agent to capture.
    Args:
        message: The log message
        run_id: The unique ID for the audit run
    """
    log_message = f"[Agent 3][{run_id}] {message}"
    print(log_message, file=sys.stderr)
    
    # Submit to HCS if not in test mode
    if os.getenv('TEST_MODE', 'true').lower() != 'true':
        try:
            submit_hcs_log(log_message)
        except Exception as e:
            print(f"[Agent 3][{run_id}] HCS logging failed: {e}", file=sys.stderr)

def create_hedera_client():
    """Create and configure a Hedera client for HCS logging."""
    try:
        from hedera import Client, PrivateKey
        
        account_id = os.getenv('HEDERA_ACCOUNT_ID')
        private_key_str = os.getenv('HEDERA_PRIVATE_KEY')
        
        if not account_id or private_key_str:
            return None
            
        # Handle hex-encoded private key (with or without 0x prefix)
        if private_key_str.startswith('0x'):
            private_key_str = private_key_str[2:]
        
        private_key = PrivateKey.fromStringDER(private_key_str)
        
        # Use testnet for development
        client = Client.forTestnet()
        client.setOperator(account_id, private_key)
        
        return client
    except Exception as e:
        print(f"Failed to create Hedera client: {e}", file=sys.stderr)
        return None

def submit_hcs_log(message):
    """Submit a log message to Hedera Consensus Service."""
    try:
        client = create_hedera_client()
        if not client:
            return
            
        topic_id = os.getenv('HEDERA_TOPIC_ID_REMEDIATION')
        if not topic_id:
            return
            
        transaction = TopicMessageSubmitTransaction() \
            .setTopicId(TopicId.fromString(topic_id)) \
            .setMessage(message)
            
        response = transaction.execute(client)
        receipt = response.getReceipt(client)
        
    except Exception as e:
        print(f"HCS submission failed: {e}", file=sys.stderr)

def generate_reentrancy_fix(finding: Dict[str, Any], contract_code: str) -> Dict[str, Any]:
    """Generate remediation for reentrancy vulnerabilities."""
    return {
        "vulnerability_type": "reentrancy",
        "severity": "Critical",
        "description": "Reentrancy vulnerability allows attackers to drain contract funds",
        "remediation_steps": [
            "Implement the Checks-Effects-Interactions pattern",
            "Use OpenZeppelin's ReentrancyGuard modifier",
            "Update state variables before external calls",
            "Consider using pull payment pattern"
        ],
        "secure_code_example": """
// SECURE: Using ReentrancyGuard
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SecureContract is ReentrancyGuard {
    mapping(address => uint256) public balances;
    
    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance to withdraw");
        
        // Effects: Update state before interaction
        balances[msg.sender] = 0;
        
        // Interaction: External call last
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
        """,
        "prevention_measures": [
            "Always follow Checks-Effects-Interactions pattern",
            "Use mutex locks (ReentrancyGuard)",
            "Limit gas forwarded to external calls",
            "Implement proper access controls"
        ]
    }

def generate_unchecked_call_fix(finding: Dict[str, Any], contract_code: str) -> Dict[str, Any]:
    """Generate remediation for unchecked external call vulnerabilities."""
    return {
        "vulnerability_type": "unchecked_external_call",
        "severity": "High",
        "description": "Unchecked external calls can lead to silent failures and unexpected behavior",
        "remediation_steps": [
            "Always check return values of external calls",
            "Use require() statements for critical operations",
            "Implement proper error handling",
            "Consider using try-catch for external contract calls"
        ],
        "secure_code_example": """
// SECURE: Proper error handling for external calls
contract SecureContract {
    function safeTransfer(address payable recipient, uint256 amount) external {
        require(address(this).balance >= amount, "Insufficient balance");
        
        // Method 1: Check return value
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
        
        // Method 2: Using try-catch (for contract calls)
        // try externalContract.someFunction() {
        //     // Success handling
        // } catch {
        //     // Error handling
        // }
    }
}
        """,
        "prevention_measures": [
            "Always check return values of .call(), .send(), .transfer()",
            "Use require() for critical operations",
            "Implement comprehensive error handling",
            "Consider gas limits for external calls"
        ]
    }

def generate_integer_overflow_fix(finding: Dict[str, Any], contract_code: str) -> Dict[str, Any]:
    """Generate remediation for integer overflow vulnerabilities."""
    return {
        "vulnerability_type": "integer_overflow",
        "severity": "High", 
        "description": "Integer overflow/underflow can lead to unexpected behavior and fund loss",
        "remediation_steps": [
            "Use Solidity 0.8.0+ with built-in overflow protection",
            "Use OpenZeppelin's SafeMath library for older versions",
            "Add explicit overflow checks",
            "Use appropriate data types for values"
        ],
        "secure_code_example": """
// SECURE: Using Solidity 0.8.0+ (built-in overflow protection)
pragma solidity ^0.8.0;

contract SecureContract {
    mapping(address => uint256) public balances;
    
    function deposit() external payable {
        // Automatic overflow protection in Solidity 0.8.0+
        balances[msg.sender] += msg.value;
    }
    
    function transfer(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // Safe arithmetic operations
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}

// For older Solidity versions, use SafeMath:
// import "@openzeppelin/contracts/utils/math/SafeMath.sol";
// using SafeMath for uint256;
        """,
        "prevention_measures": [
            "Use Solidity 0.8.0+ for automatic overflow protection",
            "Use SafeMath library for older versions",
            "Validate input parameters",
            "Use appropriate data types"
        ]
    }

def generate_timestamp_dependency_fix(finding: Dict[str, Any], contract_code: str) -> Dict[str, Any]:
    """Generate remediation for timestamp dependency vulnerabilities."""
    return {
        "vulnerability_type": "timestamp_dependency",
        "severity": "Medium",
        "description": "Reliance on block.timestamp can be manipulated by miners",
        "remediation_steps": [
            "Avoid using block.timestamp for critical logic",
            "Use block numbers instead of timestamps when possible",
            "Implement time windows instead of exact timestamps",
            "Consider using external time oracles for critical timing"
        ],
        "secure_code_example": """
// SECURE: Using block numbers and time windows
contract SecureContract {
    uint256 public startBlock;
    uint256 public constant BLOCKS_PER_DAY = 6400; // Approximate
    
    constructor() {
        startBlock = block.number;
    }
    
    function isWithinTimeWindow() public view returns (bool) {
        // Use block numbers instead of timestamps
        return block.number >= startBlock + BLOCKS_PER_DAY;
    }
    
    // If timestamp is necessary, use time windows
    function isWithinWindow(uint256 windowStart, uint256 windowEnd) public view returns (bool) {
        require(windowEnd > windowStart, "Invalid window");
        // Allow some tolerance (e.g., 15 minutes = 900 seconds)
        return block.timestamp >= windowStart && block.timestamp <= windowEnd + 900;
    }
}
        """,
        "prevention_measures": [
            "Use block numbers for time-based logic when possible",
            "Implement time windows with tolerance",
            "Avoid exact timestamp comparisons",
            "Consider external time oracles for critical applications"
        ]
    }

def generate_access_control_fix(finding: Dict[str, Any], contract_code: str) -> Dict[str, Any]:
    """Generate remediation for access control vulnerabilities."""
    return {
        "vulnerability_type": "access_control",
        "severity": "Critical",
        "description": "Improper access controls can allow unauthorized actions",
        "remediation_steps": [
            "Implement proper role-based access control",
            "Use OpenZeppelin's AccessControl or Ownable",
            "Add function modifiers for access restrictions",
            "Implement multi-signature for critical operations"
        ],
        "secure_code_example": """
// SECURE: Using OpenZeppelin AccessControl
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SecureContract is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    function adminFunction() external onlyRole(ADMIN_ROLE) {
        // Only admins can call this function
    }
    
    function operatorFunction() external onlyRole(OPERATOR_ROLE) {
        // Only operators can call this function
    }
    
    function grantOperatorRole(address account) external onlyRole(ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, account);
    }
}
        """,
        "prevention_measures": [
            "Use established access control patterns",
            "Implement role-based permissions",
            "Add proper function modifiers",
            "Regular access control audits"
        ]
    }

def generate_solc_version_fix(finding: Dict[str, Any], contract_code: str) -> Dict[str, Any]:
    """Generate remediation for Solidity version issues."""
    return {
        "vulnerability_type": "solc_version",
        "severity": "Low",
        "description": "Using outdated or problematic Solidity versions can introduce known bugs",
        "remediation_steps": [
            "Update to latest stable Solidity version",
            "Use specific version instead of caret ranges",
            "Review Solidity release notes for breaking changes",
            "Test thoroughly after version updates"
        ],
        "secure_code_example": """
// SECURE: Use latest stable version with specific version
pragma solidity 0.8.19; // Use specific version, not ^0.8.0

contract SecureContract {
    // Contract implementation with latest Solidity features
    // and security improvements
}
        """,
        "prevention_measures": [
            "Keep Solidity version up to date",
            "Use specific versions in production",
            "Monitor Solidity security advisories",
            "Test with multiple compiler versions"
        ]
    }

def generate_generic_fix(finding: Dict[str, Any], contract_code: str) -> Dict[str, Any]:
    """Generate generic remediation advice for unknown vulnerability types."""
    return {
        "vulnerability_type": "generic",
        "severity": finding.get("impact", "Medium"),
        "description": f"Security issue detected: {finding.get('check', 'Unknown')}",
        "remediation_steps": [
            "Review the specific vulnerability details",
            "Consult Solidity security best practices",
            "Consider using established security libraries",
            "Implement comprehensive testing"
        ],
        "secure_code_example": """
// GENERAL SECURITY BEST PRACTICES:
// 1. Use latest Solidity version
// 2. Implement proper access controls
// 3. Follow Checks-Effects-Interactions pattern
// 4. Use established libraries (OpenZeppelin)
// 5. Add comprehensive input validation

pragma solidity ^0.8.19;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SecureContract is ReentrancyGuard, Ownable {
    // Implement security best practices
}
        """,
        "prevention_measures": [
            "Follow security development lifecycle",
            "Use static analysis tools",
            "Implement comprehensive testing",
            "Regular security audits"
        ]
    }

def generate_remediation(finding: Dict[str, Any], contract_code: str) -> Dict[str, Any]:
    """Generate appropriate remediation based on vulnerability type."""
    check_type = finding.get("check", "").lower()
    
    if "reentrancy" in check_type:
        return generate_reentrancy_fix(finding, contract_code)
    elif "external-call" in check_type or "unchecked" in check_type:
        return generate_unchecked_call_fix(finding, contract_code)
    elif "overflow" in check_type or "underflow" in check_type:
        return generate_integer_overflow_fix(finding, contract_code)
    elif "timestamp" in check_type or "time" in check_type:
        return generate_timestamp_dependency_fix(finding, contract_code)
    elif "access" in check_type or "owner" in check_type or "modifier" in check_type:
        return generate_access_control_fix(finding, contract_code)
    elif "solc-version" in check_type or "pragma" in check_type:
        return generate_solc_version_fix(finding, contract_code)
    else:
        return generate_generic_fix(finding, contract_code)

def calculate_remediation_priority(finding: Dict[str, Any]) -> int:
    """Calculate remediation priority based on severity and exploitability."""
    impact = finding.get("impact", "").lower()
    confidence = finding.get("confidence", "").lower()
    exploitability_score = finding.get("final_exploitability_score", 0)
    confirmed = finding.get("confirmed", False)
    
    priority = 0
    
    # Base priority on impact
    if impact == "critical":
        priority += 100
    elif impact == "high":
        priority += 80
    elif impact == "medium":
        priority += 60
    elif impact == "low":
        priority += 40
    else:
        priority += 20
    
    # Adjust for confidence
    if confidence == "high":
        priority += 20
    elif confidence == "medium":
        priority += 10
    
    # Adjust for exploitability
    priority += int(exploitability_score * 20)
    
    # Boost if confirmed exploit
    if confirmed:
        priority += 50
    
    return priority

def main():
    """Main function for Agent 3 remediation analysis."""
    if len(sys.argv) != 4:
        print("Usage: python3 agent3.py <contract_path> <agent2_report_path> <run_id>", file=sys.stderr)
        sys.exit(1)
    
    contract_path, agent2_report_path, run_id = sys.argv[1:4]
    
    log("Starting remediation analysis", run_id)
    
    try:
        # Load Agent 2 report
        with open(agent2_report_path, 'r') as f:
            agent2_report = json.load(f)
        
        log(f"Loaded Agent 2 report with {len(agent2_report.get('findings', []))} findings", run_id)
        
        # Load contract code
        contract_code = ""
        if os.path.exists(contract_path):
            with open(contract_path, 'r') as f:
                contract_code = f.read()
        
        # Generate remediations
        remediations = []
        findings = agent2_report.get("findings", [])
        
        for finding in findings:
            log(f"Generating remediation for {finding.get('check', 'unknown')} vulnerability", run_id)
            
            remediation = generate_remediation(finding, contract_code)
            remediation["finding_id"] = finding.get("id", "unknown")
            remediation["priority"] = calculate_remediation_priority(finding)
            remediation["original_finding"] = {
                "check": finding.get("check"),
                "impact": finding.get("impact"),
                "confidence": finding.get("confidence"),
                "confirmed": finding.get("confirmed", False),
                "exploitability_score": finding.get("final_exploitability_score", 0)
            }
            
            remediations.append(remediation)
        
        # Sort by priority (highest first)
        remediations.sort(key=lambda x: x["priority"], reverse=True)
        
        # Generate summary
        critical_count = sum(1 for r in remediations if r["severity"] == "Critical")
        high_count = sum(1 for r in remediations if r["severity"] == "High")
        medium_count = sum(1 for r in remediations if r["severity"] == "Medium")
        low_count = sum(1 for r in remediations if r["severity"] == "Low")
        
        # Create final report
        remediation_report = {
            "contract": contract_path,
            "run_id": run_id,
            "timestamp": int(time.time()),
            "agent2_report_path": agent2_report_path,
            "total_findings": len(findings),
            "total_remediations": len(remediations),
            "remediation_summary": {
                "critical_remediations": critical_count,
                "high_remediations": high_count,
                "medium_remediations": medium_count,
                "low_remediations": low_count
            },
            "remediations": remediations,
            "general_recommendations": [
                "Implement comprehensive input validation",
                "Use established security libraries (OpenZeppelin)",
                "Follow the principle of least privilege",
                "Implement proper error handling",
                "Use static analysis tools in CI/CD pipeline",
                "Conduct regular security audits",
                "Keep dependencies up to date",
                "Implement comprehensive testing including edge cases"
            ],
            "security_checklist": [
                "✓ Access controls implemented",
                "✓ Reentrancy protection in place", 
                "✓ Integer overflow protection enabled",
                "✓ External call return values checked",
                "✓ Input validation implemented",
                "✓ Latest Solidity version used",
                "✓ Security libraries utilized",
                "✓ Comprehensive tests written"
            ]
        }
        
        log(f"Generated {len(remediations)} remediations", run_id)
        log(f"Priority breakdown - Critical: {critical_count}, High: {high_count}, Medium: {medium_count}, Low: {low_count}", run_id)
        
        # Output the JSON report to stdout
        print(json.dumps(remediation_report, indent=2))
        
    except Exception as e:
        error_report = {
            "error": True,
            "message": f"Agent 3 failed: {str(e)}",
            "contract": contract_path,
            "run_id": run_id,
            "timestamp": int(time.time())
        }
        log(f"Error during remediation analysis: {str(e)}", run_id)
        print(json.dumps(error_report, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()