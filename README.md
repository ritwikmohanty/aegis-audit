# Aegis Audit

> **AI-Powered Smart Contract Security through Decentralized Prediction Markets**

Aegis Audit is a platform that combines artificial intelligence, blockchain technology, and prediction markets to create a community-driven smart contract security analysis ecosystem on the Hedera network.

## 🌟 Overview

Aegis Audit revolutionizes smart contract security by:
- **Multi-Agent AI Analysis**: Deploying specialized AI agents for comprehensive vulnerability detection
- **Prediction Markets**: Allowing users to bet on contract security outcomes, creating market-driven security assessments
- **Hedera Consensus Service (HCS)**: Providing immutable audit trails and transparent logging
- **Real-time Analysis**: Offering instant feedback on smart contract vulnerabilities
- **Community Participation**: Enabling traders to earn rewards while improving security standards

## 🏗️ Architecture

The platform consists of four main components:

### 1. **Frontend** (Next.js + TypeScript)
- Modern React-based UI with Tailwind CSS
- Hedera wallet integration (WalletConnect)
- Real-time price feeds via Pyth Network
- Interactive prediction market interface
- Contract submission and analysis tracking
- AI chat assistant powered by LangChain

### 2. **Backend** (Node.js + Express)
- RESTful API for market and analysis management
- MongoDB/In-memory storage for development
- Multi-stage contract analysis orchestration
- File upload and processing
- Real-time analysis status tracking
- Rate limiting and security middleware

### 3. **Smart Contracts** (Solidity + Hardhat)
- **MarketFactory**: Deploys and manages prediction markets
- **Market**: Individual market logic with AMM (Automated Market Maker)
- **MarketTokens**: HTS token management for YES/NO shares
- **AuditTrail**: HCS integration for immutable logging
- Hedera Token Service (HTS) integration
- OpenZeppelin security standards

### 4. **AI Analysis System** (Multi-Agent Architecture)
- **Master Agent**: Orchestrates the entire analysis pipeline using LangChain
- **Agent 1**: Static analysis using Slither
- **Agent 2**: Symbolic execution and exploit confirmation using Mythril
- **Agent 3**: AI-powered remediation and security recommendations
- HCS logging for complete audit transparency

## 🔧 Technology Stack

### Frontend
- **Framework**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Blockchain**: Hedera SDK, WalletConnect, Viem, Wagmi
- **AI**: LangChain, OpenAI integration
- **Data**: TanStack Query, Pyth Network price feeds
- **State**: React hooks, Zod validation

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ORM)
- **Security**: Helmet, CORS, Rate limiting
- **Blockchain**: Hedera SDK
- **File Processing**: Multer
- **Authentication**: JWT, bcrypt

### Smart Contracts
- **Language**: Solidity ^0.8.19
- **Framework**: Hardhat
- **Standards**: OpenZeppelin Contracts
- **Testing**: Hardhat/Chai/Ethers
- **Network**: Hedera Testnet/Mainnet

### AI Agents
- **Languages**: JavaScript (Node.js), Python
- **AI Framework**: LangChain, Groq LLM
- **Analysis Tools**: Slither, Mythril
- **Blockchain**: Hedera SDK (HCS)
- **ML Libraries**: Transformers, PyTorch

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- Python 3.8+
- MongoDB (optional for production)
- Slither (for contract analysis)
- Mythril (for symbolic execution)
- Hedera testnet account
- OpenAI API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/aegis-audit.git
cd aegis-audit
```

2. **Install Smart Contracts Dependencies**
```bash
cd "HardHat 2.0"
npm install
cp env.example .env
# Edit .env with your Hedera credentials
```

3. **Install Backend Dependencies**
```bash
cd ../backend
npm install
cp .env.example .env
# Configure environment variables
```

4. **Install Frontend Dependencies**
```bash
cd ../frontend
npm install
cp .env.example .env
# Add OpenAI and WalletConnect credentials
```

5. **Install AI Agent Dependencies**
```bash
cd ../ai
npm install
pip install -r requirements.txt
```

### Environment Configuration

#### Backend (.env)
```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/aegis-audit

# Hedera Configuration
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_NETWORK=testnet

# HCS Topics
ANALYSIS_RESULTS_TOPIC_ID=0.0.xxxxx
REMEDIATION_RESULTS_TOPIC_ID=0.0.xxxxx

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=http://localhost:3000
```

#### Frontend (.env)
```env
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_WALLET_CONNECT_ID=your_project_id
NEXT_PUBLIC_HEDERA_RPC_URL=https://testnet.hashio.io/api
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
```

#### Smart Contracts (.env)
```env
HEDERA_TESTNET_RPC_URL=https://testnet.hashio.io/api
HEDERA_TESTNET_PRIVATE_KEY=your_private_key_here
REPORT_GAS=true
```

#### AI Agents (.env)
```env
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=your_private_key
HEDERA_TOPIC_ID=0.0.xxxxx
HEDERA_TOPIC_ID_REMEDIATION=0.0.xxxxx
GROQ_API_KEY=your_groq_api_key
TEST_MODE=false
```

## 📦 Deployment

### 1. Deploy Smart Contracts

```bash
cd "HardHat 2.0"

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Hedera testnet
npm run deploy:hedera

# Verify contracts
npm run verify:hedera

# Create HCS topic
npm run create:hcs-topic
```

### 2. Start Backend Server

```bash
cd backend
npm run dev  # Development
npm start    # Production
```

Server will be available at `http://localhost:3001`

### 3. Start Frontend

```bash
cd frontend
npm run dev    # Development
npm run build  # Build for production
npm start      # Production server
```

Application will be available at `http://localhost:3000`

### 4. Run AI Analysis

```bash
# Test individual agents
node ai/agent1.js <contract_path> <run_id>
python3 ai/agent2.py <contract_path> <agent1_report> <run_id>
python3 ai/agent3.py <contract_path> <agent2_report> <run_id>

# Run full master agent
node master.js
```

## 🎯 Features

### For Security Researchers
- **Multi-tool Analysis**: Combines Slither, Mythril, and AI models
- **Detailed Reports**: Comprehensive vulnerability assessments
- **Remediation Guidance**: Actionable fixes with secure code examples
- **Immutable Audit Trail**: All analysis logged to HCS

### For Traders
- **Binary Markets**: Simple YES/NO predictions on vulnerabilities
- **AMM Liquidity**: Automated market making for instant trades
- **Real-time Prices**: Dynamic pricing based on market sentiment
- **Reward System**: Earn from correct predictions

### For Developers
- **Contract Submission**: Multiple submission methods (address, repo, file)
- **Live Tracking**: Real-time analysis progress monitoring
- **Network Support**: Ethereum, Hedera, Polygon, BSC
- **API Access**: RESTful endpoints for integration

## 📚 API Documentation

### Markets API

**GET /api/markets**
```json
{
  "success": true,
  "data": [...]
}
```

**POST /api/markets**
```json
{
  "question": "Does contract contain vulnerabilities?",
  "endTime": 1735689600,
  "contractAddress": "0x..."
}
```

**GET /api/markets/:marketId**

**POST /api/markets/:marketId/resolve**

### Analysis API

**POST /api/analysis/upload**
- Upload contract files for analysis
- Returns analysisId

**GET /api/analysis/:analysisId/status**
- Get real-time analysis progress

**GET /api/analysis/:analysisId/results**
- Retrieve complete analysis results

### Audit API

**GET /api/audit/logs**
- Query HCS audit logs

**POST /api/audit/verify**
- Verify audit integrity

## 🧪 Testing

### Smart Contract Tests
```bash
cd "HardHat 2.0"
npm test                    # All tests
npm run test:mock          # Mock market tests
npm run gas-report         # Gas usage report
```

### Backend Tests
```bash
cd backend
npm test
```

### AI Agent Tests
```bash
cd ai
node test-master.js        # Test master agent
node test-hcs.js          # Test HCS integration
```

## 🔐 Security Features

- **ReentrancyGuard**: Protection against reentrancy attacks
- **Access Control**: Role-based permissions using OpenZeppelin
- **Rate Limiting**: DDoS protection on API endpoints
- **Input Validation**: Comprehensive data sanitization
- **Secure Headers**: Helmet.js security middleware
- **Immutable Logging**: HCS audit trail
- **Multi-tool Analysis**: Layered security verification

## 📊 Project Structure

```
aegis-audit/
├── frontend/              # Next.js frontend application
│   ├── src/
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   └── lib/          # Utilities
│   └── public/           # Static assets
├── backend/              # Express.js backend
│   └── src/
│       ├── config/       # Configuration
│       ├── controllers/  # Route controllers
│       ├── models/       # Data models
│       ├── routes/       # API routes
│       ├── services/     # Business logic
│       └── utils/        # Utilities
├── HardHat 2.0/         # Smart contracts
│   ├── contracts/       # Solidity contracts
│   ├── scripts/         # Deployment scripts
│   ├── test/           # Contract tests
│   └── deployments/    # Deployment info
└── ai/                 # AI analysis agents
    ├── agent1.js       # Static analysis
    ├── agent2.py       # Symbolic execution
    ├── agent3.py       # Remediation
    └── master.js       # Orchestration
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Write comprehensive tests
- Update documentation
- Add meaningful commit messages

## 🙏 Acknowledgments

- Hedera Hashgraph for the consensus service
- OpenZeppelin for secure contract templates
- Slither and Mythril for analysis tools
- LangChain for AI orchestration
- The open-source community

