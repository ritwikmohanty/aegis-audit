// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IHederaTokenService.sol"; // Assuming IHederaTokenService.sol is in the same directory

/**
 * @title MarketTokens
 * @dev A contract to manage YES/NO tokens for the PredictionMarket via Hedera Token Service.
 * This contract acts as a factory for creating token pairs for new markets.
 */
contract MarketTokens is Ownable {
    // The main PredictionMarket contract address
    address public predictionMarket;

    // Hedera Token Service precompile address
    address constant HTS_PRECOMPILE_ADDRESS = 0x167;
    IHederaTokenService constant hts = IHederaTokenService(HTS_PRECOMPILE_ADDRESS);

    constructor(address _predictionMarket) Ownable(msg.sender) {
        predictionMarket = _predictionMarket;
    }

    /**
     * @dev Creates a pair of YES/NO tokens for a new market using HTS.
     * @param yesName The name for the YES token.
     * @param yesSymbol The symbol for the YES token.
     * @param noName The name for the NO token.
     * @param noSymbol The symbol for the NO token.
     * @return yesTokenAddress The address of the created YES token.
     * @return noTokenAddress The address of the created NO token.
     */
    function createMarketTokens(
        string memory yesName,
        string memory yesSymbol,
        string memory noName,
        string memory noSymbol
    ) external returns (address yesTokenAddress, address noTokenAddress) {
        require(msg.sender == predictionMarket, "Only prediction market can create tokens");

        // Define keys for the new tokens. For simplicity, we use a contract key.
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey({
            keyType: 1, // KEY_TYPE_CONTRACT
            keyValue: IHederaTokenService.KeyValue({
                inheritAccountKey: false,
                contractId: address(this),
                ed25519: new bytes(0),
                ECDSA_secp256k1: new bytes(0),
                delegatableContractId: address(0)
            })
        });

        // Create YES token
        (int responseCodeYes, address createdYesToken) = hts.createFungibleToken(
            IHederaTokenService.HederaToken({
                name: yesName,
                symbol: yesSymbol,
                memo: "YES Token",
                treasury: address(predictionMarket),
                tokenSupplyType: true, // Infinite supply
                maxSupply: 0,
                freezeDefault: false,
                tokenKeys: keys,
                expiry: IHederaTokenService.Expiry({
                    second: 0,
                    autoRenewAccount: address(0),
                    autoRenewPeriod: 7890000 // ~3 months
                })
            }),
            0, // initial supply
            18 // decimals
        );
        require(responseCodeYes == 22, "YES token creation failed");
        yesTokenAddress = createdYesToken;

        // Create NO token
        (int responseCodeNo, address createdNoToken) = hts.createFungibleToken(
            IHederaTokenService.HederaToken({
                name: noName,
                symbol: noSymbol,
                memo: "NO Token",
                treasury: address(predictionMarket),
                tokenSupplyType: true, // Infinite supply
                maxSupply: 0,
                freezeDefault: false,
                tokenKeys: keys,
                expiry: IHederaTokenService.Expiry({
                    second: 0,
                    autoRenewAccount: address(0),
                    autoRenewPeriod: 7890000 // ~3 months
                })
            }),
            0, // initial supply
            18 // decimals
        );
        require(responseCodeNo == 22, "NO token creation failed");
        noTokenAddress = createdNoToken;
    }

    // Optional: You can implement a uri function to point to token metadata
    function uri(uint256 id) public view returns (string memory) {
        // You could build a metadata server that returns details based on the ID
        // This is kept from the original ERC1155, but its usage would change.
        return "";
    }
}