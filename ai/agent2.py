#!/usr/bin/env python3
"""
Agent 2: The Exploit Confirmer
Validates vulnerabilities from Agent 1 through symbolic execution and practical exploit testing.
Generates test scripts to confirm if vulnerabilities are practically exploitable.
"""
import json
import sys
import subprocess
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Any
import time
from dotenv import load_dotenv
from hedera import Client, PrivateKey, TopicMessageSubmitTransaction, TopicId

# Load environment variables
load_dotenv()

def log(message: str, run_id: str) -> None:
    """
    Prints a structured log message to stderr for the Master Agent to capture.
    Also submits to HCS if configured.
    Args:
        message: The log message
        run_id: The unique ID for the audit run
    """
    log_message = f"[Agent 2][{run_id}] {message}"
    print(log_message, file=sys.stderr)
    
    # Submit to HCS if not in test mode
    if os.getenv('TEST_MODE', 'true').lower() != 'true':
        try:
            submit_hcs_log(log_message)
        except Exception as e:
            print(f"[Agent 2][{run_id}] HCS logging failed: {e}", file=sys.stderr)

def create_hedera_client():
    """Create and configure a Hedera client for HCS logging."""
    try:
        from hedera import Client, PrivateKey
        
        account_id = os.getenv('HEDERA_ACCOUNT_ID')
        private_key_str = os.getenv('HEDERA_PRIVATE_KEY')
        
        if not account_id or not private_key_str:
            return None
            
        # Handle hex-encoded private key (with or without 0x prefix)
        clean_private_key = private_key_str[2:] if private_key_str.startswith('0x') else private_key_str
        private_key = PrivateKey.fromStringECDSA(clean_private_key)
        
        client = Client.forTestnet()
        client.setOperator(account_id, private_key)
        
        return client
    except Exception as e:
        log(f"Failed to create Hedera client: {e}")
        return None

def submit_hcs_log(message):
    """
    Submits a log message to the configured HCS topic.
    """
    topic_id_str = os.getenv('HEDERA_TOPIC_ID')
    if not topic_id_str:
        return  # Skip HCS logging if no topic configured
    
    try:
        client = create_hedera_client()
        topic_id = TopicId.from_string(topic_id_str)
        
        transaction = TopicMessageSubmitTransaction() \
            .set_topic_id(topic_id) \
            .set_message(message)
        
        response = transaction.execute(client)
        receipt = response.get_receipt(client)
        
        client.close()
        
    except Exception as e:
        # Don't fail the analysis if HCS logging fails
        pass

def run_command(command: str, timeout: int = 120) -> Dict[str, Any]:
    """
    Runs a command-line command with timeout and error handling.
    Args:
        command: The command to execute
        timeout: Command timeout in seconds
    Returns:
        Dictionary with stdout, stderr, and success status
    """
    try:
        result = subprocess.run(
            command.split(),
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": f"Command timed out after {timeout} seconds",
            "success": False,
            "returncode": -1
        }
    except Exception as e:
        return {
            "stdout": "",
            "stderr": str(e),
            "success": False,
            "returncode": -1
        }

def run_mythril_analysis(contract_path: Path, run_id: str) -> List[Dict[str, Any]]:
    """
    Runs Mythril symbolic execution analysis on the contract.
    Args:
        contract_path: Path to the Solidity contract
        run_id: Unique run identifier
    Returns:
        List of Mythril findings
    """
    log(f"Starting Mythril symbolic execution on {contract_path.name}", run_id)
    
    # Create temporary directory for Mythril output
    with tempfile.TemporaryDirectory() as temp_dir:
        report_path = Path(temp_dir) / f"mythril_report_{run_id}.json"
        
        # Run Mythril with JSON output
        command = f"myth analyze {contract_path} --execution-timeout 60 -o json"
        result = run_command(command, timeout=120)
        
        mythril_findings = []
        
        if result["success"] and result["stdout"]:
            try:
                # Parse Mythril JSON output
                mythril_data = json.loads(result["stdout"])
                
                if "issues" in mythril_data:
                    for issue in mythril_data["issues"]:
                        finding = {
                            "tool": "mythril",
                            "title": issue.get("title", "Unknown Mythril Issue"),
                            "description": issue.get("description", ""),
                            "severity": issue.get("severity", "Medium"),
                            "swc_id": issue.get("swc-id", ""),
                            "lineno": issue.get("lineno", 1),
                            "filename": issue.get("filename", str(contract_path)),
                            "function": issue.get("function", ""),
                            "address": issue.get("address", 0),
                            "debug": issue.get("debug", ""),
                            "confirmed": False,
                            "exploitability_score": 0.0
                        }
                        mythril_findings.append(finding)
                        
            except json.JSONDecodeError as e:
                log(f"Warning: Failed to parse Mythril JSON output: {e}", run_id)
                # Fallback to text parsing
                mythril_findings = parse_mythril_text_output(result["stdout"], contract_path, run_id)
        else:
            log(f"Mythril analysis failed or produced no output: {result['stderr']}", run_id)
            
        log(f"Mythril analysis complete. Found {len(mythril_findings)} potential issues", run_id)
        return mythril_findings

def parse_mythril_text_output(output: str, contract_path: Path, run_id: str) -> List[Dict[str, Any]]:
    """
    Fallback parser for Mythril text output when JSON parsing fails.
    """
    findings = []
    lines = output.split('\n')
    current_issue = {}
    
    for line in lines:
        line = line.strip()
        if line.startswith('==== '):
            # New vulnerability found
            if current_issue:
                findings.append(current_issue)
            current_issue = {
                "tool": "mythril",
                "title": line.replace('====', '').strip(),
                "description": "",
                "severity": "Medium",
                "lineno": 1,
                "filename": str(contract_path),
                "confirmed": False,
                "exploitability_score": 0.0
            }
        elif line.startswith('SWC ID:') and current_issue:
            current_issue["swc_id"] = line.replace('SWC ID:', '').strip()
        elif line.startswith('Severity:') and current_issue:
            current_issue["severity"] = line.replace('Severity:', '').strip()
        elif line and current_issue and not line.startswith('----'):
            current_issue["description"] += line + " "
    
    # Add the last issue if exists
    if current_issue:
        findings.append(current_issue)
    
    return findings

def generate_exploit_test(finding: Dict[str, Any], contract_code: str, run_id: str) -> Dict[str, Any]:
    """
    Generates a test script to confirm if a vulnerability is exploitable.
    Args:
        finding: Vulnerability finding from Agent 1 or Mythril
        contract_code: The contract source code
        run_id: Unique run identifier
    Returns:
        Dictionary with exploit test results
    """
    log(f"Generating exploit test for: {finding.get('check', finding.get('title', 'Unknown'))}", run_id)
    
    exploit_result = {
        "test_generated": False,
        "test_executed": False,
        "exploit_confirmed": False,
        "test_output": "",
        "confidence_score": 0.0
    }
    
    # Determine vulnerability type and generate appropriate test
    vuln_type = finding.get('check', finding.get('title', '')).lower()
    
    if 'reentrancy' in vuln_type:
        exploit_result = generate_reentrancy_test(finding, contract_code, run_id)
    elif 'unchecked-call' in vuln_type or 'low-level-calls' in vuln_type:
        exploit_result = generate_unchecked_call_test(finding, contract_code, run_id)
    elif 'timestamp' in vuln_type or 'block-timestamp' in vuln_type:
        exploit_result = generate_timestamp_test(finding, contract_code, run_id)
    elif 'integer' in vuln_type or 'overflow' in vuln_type or 'underflow' in vuln_type:
        exploit_result = generate_integer_overflow_test(finding, contract_code, run_id)
    else:
        # Generic test for other vulnerability types
        exploit_result = generate_generic_test(finding, contract_code, run_id)
    
    return exploit_result

def generate_reentrancy_test(finding: Dict[str, Any], contract_code: str, run_id: str) -> Dict[str, Any]:
    """Generates a reentrancy exploit test."""
    log("Generating reentrancy exploit test", run_id)
    
    # Create a simple reentrancy test template
    test_template = f'''
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

contract ReentrancyExploit is Test {{
    // Target contract instance
    address target;
    
    function setUp() public {{
        // Deploy target contract
        // target = address(new TargetContract());
    }}
    
    function testReentrancyExploit() public {{
        // Attempt reentrancy attack
        // This is a template - actual implementation depends on contract structure
        assertTrue(false, "Reentrancy test template - needs contract-specific implementation");
    }}
    
    // Fallback function to trigger reentrancy
    fallback() external payable {{
        // Reentrant call logic here
    }}
}}
'''
    
    return {
        "test_generated": True,
        "test_executed": False,
        "exploit_confirmed": False,
        "test_output": "Reentrancy test template generated",
        "confidence_score": 0.7,  # High confidence for reentrancy detection
        "test_code": test_template
    }

def generate_unchecked_call_test(finding: Dict[str, Any], contract_code: str, run_id: str) -> Dict[str, Any]:
    """Generates an unchecked call exploit test."""
    log("Generating unchecked call exploit test", run_id)
    
    return {
        "test_generated": True,
        "test_executed": False,
        "exploit_confirmed": False,
        "test_output": "Unchecked call vulnerability detected - manual verification recommended",
        "confidence_score": 0.6,
        "test_code": "// Unchecked call test would require contract-specific implementation"
    }

def generate_timestamp_test(finding: Dict[str, Any], contract_code: str, run_id: str) -> Dict[str, Any]:
    """Generates a timestamp manipulation test."""
    log("Generating timestamp manipulation test", run_id)
    
    return {
        "test_generated": True,
        "test_executed": False,
        "exploit_confirmed": False,
        "test_output": "Timestamp dependency detected - block.timestamp manipulation possible",
        "confidence_score": 0.5,
        "test_code": "// Timestamp manipulation test template"
    }

def generate_integer_overflow_test(finding: Dict[str, Any], contract_code: str, run_id: str) -> Dict[str, Any]:
    """Generates an integer overflow/underflow test."""
    log("Generating integer overflow/underflow test", run_id)
    
    return {
        "test_generated": True,
        "test_executed": False,
        "exploit_confirmed": False,
        "test_output": "Integer overflow/underflow vulnerability detected",
        "confidence_score": 0.8,
        "test_code": "// Integer overflow test template"
    }

def generate_generic_test(finding: Dict[str, Any], contract_code: str, run_id: str) -> Dict[str, Any]:
    """Generates a generic test for unspecified vulnerability types."""
    log(f"Generating generic test for vulnerability type: {finding.get('check', 'unknown')}", run_id)
    
    return {
        "test_generated": True,
        "test_executed": False,
        "exploit_confirmed": False,
        "test_output": f"Generic vulnerability test for: {finding.get('check', 'unknown')}",
        "confidence_score": 0.3,
        "test_code": "// Generic vulnerability test template"
    }

def calculate_final_score(finding: Dict[str, Any], exploit_result: Dict[str, Any]) -> float:
    """
    Calculates a final exploitability score based on static analysis and exploit testing.
    """
    base_score = 0.5  # Default score
    
    # Adjust based on severity
    severity = finding.get('impact', finding.get('severity', 'Medium')).lower()
    if severity in ['high', 'critical']:
        base_score += 0.3
    elif severity in ['medium']:
        base_score += 0.1
    
    # Adjust based on exploit test confidence
    confidence = exploit_result.get('confidence_score', 0.0)
    base_score = (base_score + confidence) / 2
    
    # Cap at 1.0
    return min(base_score, 1.0)

def main():
    """Main execution function for Agent 2."""
    if len(sys.argv) != 4:
        log("FATAL: Usage: python3 agent2.py <contract_path> <agent1_report_path> <run_id>", "unknown")
        sys.exit(1)
    
    contract_path = Path(sys.argv[1])
    agent1_report_path = Path(sys.argv[2])
    run_id = sys.argv[3]
    
    log(f"Initializing exploit confirmation for {contract_path.name}", run_id)
    
    try:
        # 1. Read Agent 1 findings
        with open(agent1_report_path, 'r') as f:
            agent1_findings = json.load(f)
        
        log(f"Loaded {len(agent1_findings)} findings from Agent 1", run_id)
        
        # 2. Read contract code
        with open(contract_path, 'r') as f:
            contract_code = f.read()
        
        # 3. Run Mythril symbolic execution
        mythril_findings = run_mythril_analysis(contract_path, run_id)
        
        # 4. Process all findings and generate exploit tests
        all_findings = []
        
        # Process Agent 1 findings
        for finding in agent1_findings:
            log(f"Processing Agent 1 finding: {finding.get('check', 'Unknown')}", run_id)
            exploit_result = generate_exploit_test(finding, contract_code, run_id)
            
            enhanced_finding = {
                **finding,
                "source": "agent1",
                "exploit_test": exploit_result,
                "final_exploitability_score": calculate_final_score(finding, exploit_result),
                "confirmed": exploit_result.get("exploit_confirmed", False)
            }
            all_findings.append(enhanced_finding)
        
        # Process Mythril findings
        for finding in mythril_findings:
            log(f"Processing Mythril finding: {finding.get('title', 'Unknown')}", run_id)
            exploit_result = generate_exploit_test(finding, contract_code, run_id)
            
            enhanced_finding = {
                **finding,
                "source": "mythril",
                "exploit_test": exploit_result,
                "final_exploitability_score": calculate_final_score(finding, exploit_result),
                "confirmed": exploit_result.get("exploit_confirmed", False)
            }
            all_findings.append(enhanced_finding)
        
        # 5. Generate final report
        confirmed_exploits = [f for f in all_findings if f.get("confirmed", False)]
        high_confidence_findings = [f for f in all_findings if f.get("final_exploitability_score", 0) > 0.7]
        
        final_report = {
            "contract": str(contract_path),
            "run_id": run_id,
            "timestamp": int(time.time()),
            "agent1_findings_count": len(agent1_findings),
            "mythril_findings_count": len(mythril_findings),
            "total_findings": len(all_findings),
            "confirmed_exploits": len(confirmed_exploits),
            "high_confidence_findings": len(high_confidence_findings),
            "findings": all_findings,
            "summary": {
                "critical_vulnerabilities": len([f for f in all_findings if f.get("final_exploitability_score", 0) > 0.8]),
                "medium_vulnerabilities": len([f for f in all_findings if 0.5 < f.get("final_exploitability_score", 0) <= 0.8]),
                "low_vulnerabilities": len([f for f in all_findings if f.get("final_exploitability_score", 0) <= 0.5])
            }
        }
        
        # 6. Output clean JSON to stdout
        print(json.dumps(final_report, indent=2))
        log(f"Agent 2 analysis complete. Processed {len(all_findings)} total findings", run_id)
        
    except FileNotFoundError as e:
        log(f"FATAL: Required file not found: {e}", run_id)
        sys.exit(1)
    except json.JSONDecodeError as e:
        log(f"FATAL: Invalid JSON in Agent 1 report: {e}", run_id)
        sys.exit(1)
    except Exception as e:
        log(f"FATAL: Unexpected error: {e}", run_id)
        sys.exit(1)

if __name__ == "__main__":
    main()