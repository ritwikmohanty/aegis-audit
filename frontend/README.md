# Aegis Audit - Prediction Markets

A decentralized prediction market platform built on Hedera with AI agent integration.

## Features

- **Prediction Markets**: Create and bet on future events
- **Real-time Prices**: Live HBAR/USD pricing via Pyth Network
- **AI Assistant**: Chat with an AI agent for Hedera operations
- **Wallet Integration**: Full Hedera wallet support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Add your OpenAI API key and WalletConnect project ID
```

3. Run development server:
```bash
npm run dev
```

## Environment Variables

```env
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_WALLET_CONNECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_HEDERA_RPC_URL=https://testnet.hashio.io/api
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=your_deployed_contract_address
```

## Tech Stack

- Next.js 15 with TypeScript
- Hedera Hashgraph
- Pyth Network (Price Feeds)
- LangChain (AI Agent)
- Tailwind CSS