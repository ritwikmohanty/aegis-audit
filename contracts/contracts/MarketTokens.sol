// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IHederaTokenService.sol";

/**
 * @title MarketTokens
 * @dev A contract to manage YES/NO tokens for the PredictionMarket via Hedera Token Service.
 * FIX: Refactored to avoid "Stack too deep" compiler error.
 */
contract MarketTokens is Ownable {
    address public predictionMarket;

    address constant HTS_PRECOMPILE_ADDRESS = address(0x167);
    IHederaTokenService constant hts = IHederaTokenService(HTS_PRECOMPILE_ADDRESS);

    constructor(address _predictionMarket) Ownable(msg.sender) {
        predictionMarket = _predictionMarket;
    }

    /**
     * @dev Creates a pair of YES/NO tokens for a new market using HTS.
     */
    function createMarketTokens(
        string memory yesName,
        string memory yesSymbol,
        string memory noName,
        string memory noSymbol
    ) external returns (address yesTokenAddress, address noTokenAddress) {
        require(msg.sender == predictionMarket, "Only prediction market can create tokens");

        // FIX: The complex struct creation and HTS call are moved to a helper function
        // to reduce the stack depth of this main function.
        yesTokenAddress = _createSingleToken(yesName, yesSymbol, "YES Token");
        noTokenAddress = _createSingleToken(noName, noSymbol, "NO Token");
    }

    /**
     * @dev Internal helper function to create a single HTS token.
     * This prevents the "Stack too deep" error by isolating the complex logic.
     */
    function _createSingleToken(
        string memory name,
        string memory symbol,
        string memory memo
    ) internal returns (address) {
        // Define keys for the new token. We give mint/burn control to the PredictionMarket contract.
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey({
            keyType: 1, // KEY_TYPE_CONTRACT
            keyValue: IHederaTokenService.KeyValue({
                inheritAccountKey: false,
                contractId: predictionMarket, // The main contract controls the token
                ed25519: new bytes(0),
                ECDSA_secp256k1: new bytes(0),
                delegatableContractId: address(0)
            })
        });

        IHederaTokenService.HederaToken memory hederaToken = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            memo: memo,
            treasury: predictionMarket, // The main contract is the treasury
            tokenSupplyType: true, // Infinite supply
            maxSupply: 0,
            freezeDefault: false,
            tokenKeys: keys,
            expiry: IHederaTokenService.Expiry({
                second: 0,
                autoRenewAccount: address(0), // Uses treasury to auto-renew
                autoRenewPeriod: 7890000 // ~3 months
            })
        });

        (int responseCode, address createdTokenAddress) = hts.createFungibleToken(
            hederaToken,
            0, // initial supply
            18 // decimals
        );
        require(responseCode == 22, "HTS token creation failed"); // 22 is SUCCESS code

        return createdTokenAddress;
    }
}