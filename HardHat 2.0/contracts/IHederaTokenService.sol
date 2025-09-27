// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0;

interface IHederaTokenService {
    struct Expiry {
        uint32 second;
        address autoRenewAccount;
        uint32 autoRenewPeriod;
    }

    struct TokenKey {
        uint256 keyType;
        KeyValue keyValue;
    }

    struct KeyValue {
        bool inheritAccountKey;
        address contractId;
        bytes ed25519;
        bytes ECDSA_secp256k1;
        address delegatableContractId;
    }

    struct HederaToken {
        string name;
        string symbol;
        address treasury;
        string memo;
        bool tokenSupplyType;
        uint72 maxSupply;
        bool freezeDefault;
        TokenKey[] tokenKeys;
        Expiry expiry;
    }

    function createFungibleToken(
        HederaToken memory token,
        uint64 initialTotalSupply,
        uint32 decimals
    ) external returns (int, address);

    function mintToken(address token, uint64 amount, bytes[] memory metadata) external returns (int, uint64, int64[] memory);
    
    function burnToken(address token, uint64 amount, int64[] memory serialNumbers) external returns (int, uint64);

    function associateToken(address account, address token) external returns (int);

    function associateTokens(address account, address[] memory tokens) external returns (int);

    function transferToken(address token, address sender, address receiver, int64 amount) external returns (int);
}
