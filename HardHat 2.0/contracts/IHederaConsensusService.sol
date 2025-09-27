// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

interface IHederaConsensusService {
    /**
     * @dev Submits a message to an HCS topic.
     * @param topicID The ID of the topic to submit the message to.
     * @param message The message to be submitted.
     * @param transactionFee The fee to be paid for the transaction.
     * @return responseCode The response code for the operation.
     * @return topicSequenceNumber The new sequence number of the topic.
     * @return topicRunningHash The new running hash of the topic.
     */
    function submitMessage(
        address topicID,
        bytes memory message,
        uint64 transactionFee
    ) external payable returns (int256 responseCode, uint64 topicSequenceNumber, bytes32 topicRunningHash);
}
