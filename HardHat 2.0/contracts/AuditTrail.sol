// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IHederaConsensusService.sol";

/**
 * @title AuditTrail
 * @dev This contract provides a method for a backend service to submit
 * audit logs, such as AI analysis results, to a Hedera Consensus Service (HCS) topic.
 * It uses the HCS precompile to ensure data is timestamped and immutably recorded.
 */
contract AuditTrail is Ownable {
    // HCS Precompile Address
    address constant HCS_PRECOMPILE_ADDRESS = address(0x169);
    IHederaConsensusService constant hcs = IHederaConsensusService(HCS_PRECOMPILE_ADDRESS);

    // The HCS topic ID to submit messages to.
    address public topicId;

    event LogSubmitted(
        address indexed topicId,
        uint64 indexed sequenceNumber,
        bytes message
    );

    /**
     * @param _initialOwner The owner of the contract (backend service account).
     * @param _topicId The HCS topic ID for logging.
     */
    constructor(address _initialOwner, address _topicId) Ownable(_initialOwner) {
        require(_topicId != address(0), "Topic ID cannot be zero");
        topicId = _topicId;
    }

    /**
     * @dev Submits a log message to the configured HCS topic.
     * Only callable by the owner (the backend service).
     * @param _message The raw data from the AI analysis to be logged.
     */
    function submitAuditLog(bytes memory _message) external payable onlyOwner {
        // The `payable` keyword is used to allow sending HBAR to pay for the transaction fee.
        // The `transactionFee` parameter of `submitMessage` is currently ignored,
        // and the fee is paid by the value sent with the call.
        (int256 responseCode, uint64 sequenceNumber, ) = hcs.submitMessage{value: msg.value}(
            topicId,
            _message,
            0 // transactionFee parameter is unused
        );

        // Response code 22 corresponds to SUCCESS
        require(responseCode == 22, "HCS submitMessage failed");

        emit LogSubmitted(topicId, sequenceNumber, _message);
    }

    /**
     * @dev Allows the owner to update the HCS topic ID.
     * @param _newTopicId The new HCS topic ID.
     */
    function setTopicId(address _newTopicId) external onlyOwner {
        require(_newTopicId != address(0), "New Topic ID cannot be zero");
        topicId = _newTopicId;
    }
}