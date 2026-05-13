# ChainLog Project Documentation

## Overview
ChainLog is a blockchain-powered, tamper-resistant API usage logging system built using Ethereum smart contracts, Merkle trees, and SHA-256 cryptographic hashing. It demonstrates secure, immutable logging for API calls, solving the problem of trust in centralized logging systems.

## Architecture
The system follows a three-tier architecture:

```
┌─────────────────┐    ┌────────────────┐    ┌──────────────────────┐
│  React Frontend │◄──►│ Express Backend│◄──►│  Hardhat Blockchain  │
│  (Vite, :5173)  │    │   (:3001)      │    │  (Localhost :8545)   │
└─────────────────┘    └────────────────┘    └──────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │  APILogger.sol     │  ← Immutable logs, hash chain
                    │  APIKeyRegistry.sol│  ← Access control
                    └────────────────────┘
```

### Components:
1. **Blockchain Layer**: Local Ethereum network using Hardhat
2. **Backend Layer**: Express.js API gateway
3. **Frontend Layer**: React application with Vite

## Smart Contracts

### APIKeyRegistry.sol
**Location**: `contracts/APIKeyRegistry.sol`  
**Purpose**: Manages access control for API consumers.

**Key Features**:
- Consumer registration with fee payment
- Admin registration without fee
- Key revocation/reactivation
- Call count tracking
- Fee collection and withdrawal

**Functions**:
- `register(string name, string org)`: Register as consumer (payable)
- `registerAdmin(address wallet, string name, string org)`: Admin registration
- `revokeKey(address wallet)`: Revoke consumer access
- `reactivateKey(address wallet)`: Reactivate revoked key
- `withdrawFees()`: Owner withdraws collected fees
- `getConsumer(address wallet)`: View consumer details

**Modifiers**:
- `onlyOwner`: Restricts to contract owner
- `onlyActive`: Ensures caller is registered and active

### APILogger.sol
**Location**: `contracts/APILogger.sol`  
**Purpose**: Core logging contract for immutable API usage records.

**Key Features**:
- Hash-chained logs for tamper detection
- Merkle tree batching (every 10 logs)
- SHA-256 request hashing
- Integrity verification
- Emergency pause functionality

**Functions**:
- `logAPICall(...)`: Log an API call with all details
- `verifyLogIntegrity(uint256 logId)`: Verify log hasn't been tampered
- `verifyLogInBatch(uint256 logId, bytes32[] proof)`: Merkle proof verification
- `finalizeBatch()`: Finalize current Merkle batch
- `setPaused(bool paused)`: Emergency stop
- `getLog(uint256 id)`: Retrieve log details
- `getBatch(uint256 batchId)`: Get Merkle batch info

**Data Structures**:
- `APILog`: Stores log details with hash pointers
- `MerkleBatch`: Manages batched logs with Merkle roots
- `UsageSummary`: Tracks per-consumer statistics

## Backend (Express Server)
**Location**: `backend/server.js`  
**Port**: 3001  
**Purpose**: API gateway bridging frontend and blockchain.

**Responsibilities**:
- Loads deployed contracts and ABIs
- Simulates API calls with realistic data
- Computes SHA-256 hashes for requests
- Manages in-memory Merkle tree
- Caches logs for fast queries
- Exposes REST endpoints

**Key Endpoints**:
- `GET /health`: Server status
- `POST /api/simulate`: Simulate specific API call
- `POST /api/simulate/random`: Random API simulation
- `GET /api/logs`: Cached logs with pagination
- `GET /api/logs/chain`: Direct blockchain queries
- `GET /api/merkle`: Merkle tree state
- `GET /api/merkle/proof/:index`: Generate Merkle proof
- `POST /api/merkle/verify`: Verify proof
- `GET /api/consumers`: List consumers
- `POST /api/consumers/register`: Register consumer
- `POST /api/consumers/revoke`: Revoke consumer
- `GET /api/stats`: Blockchain statistics
- `GET /api/batches`: List batches
- `POST /api/batch/finalize`: Force finalize batch

### Merkle Helper
**Location**: `backend/merkle.js`  
**Purpose**: Manages Merkle tree operations.

**Features**:
- Double-hashing (SHA-256 → keccak256)
- Tree rebuilding on new leaves
- Proof generation and verification
- Tree visualization

## Frontend (React DApp)
**Location**: `frontend/`  
**Port**: 5173  
**Framework**: React + Vite

**Pages**:
1. **Dashboard** (`pages/Dashboard.jsx`): Overview statistics, contract status, live indicators
2. **Simulate API** (`pages/Simulate.jsx`): Fire simulated API calls, view on-chain logging
3. **Log Explorer** (`pages/LogExplorer.jsx`): Browse logs with filtering and pagination
4. **Merkle Verifier** (`pages/MerkleVerify.jsx`): Visualize Merkle tree, generate/verify proofs
5. **API Consumers** (`pages/Consumers.jsx`): Manage consumers (register, revoke, view stats)

**Key Features**:
- Dark theme with sidebar navigation
- Live backend status indicators
- Toast notifications
- Responsive design

## Deployment and Configuration

### Hardhat Configuration
**Location**: `hardhat.config.js`  
**Purpose**: Ethereum development environment setup.

**Features**:
- Local network configuration
- Solidity compiler settings
- Task definitions
- Gas reporting

### Deployment Script
**Location**: `ignition/modules/deploy.js`  
**Purpose**: Deploys contracts and seeds demo data.

**Steps**:
1. Deploy APIKeyRegistry with 0.001 ETH fee
2. Deploy APILogger linked to registry
3. Register 3 demo consumers
4. Log 5 demo API calls
5. Save deployment info to `deployment.json`
6. Copy ABIs to frontend

### Package Management
- **Root**: `package.json` - Scripts for chain, deploy, backend, frontend
- **Frontend**: `frontend/package.json` - React dependencies
- **Backend**: Dependencies in root package.json (Express, ethers, merkletreejs)

## Blockchain Concepts Demonstrated

| Concept | Implementation |
|---------|----------------|
| **SHA-256 Hashing** | Request payloads hashed before logging |
| **Hash Pointers/Chain** | Each log links to previous via `prevLogHash` |
| **Merkle Trees** | Batches of 10 logs → Merkle root on-chain |
| **Smart Contracts** | Two Solidity contracts on Hardhat network |
| **Immutability** | On-chain data cannot be modified |
| **Access Control** | `onlyRegistered` modifier |
| **CIA Triad** | Integrity (hashing), Confidentiality (access), Availability (decentralized) |
| **Emergency Stop** | `setPaused()` security pattern |
| **Events** | `LogRecorded`, `BatchFinalized` for auditability |
| **Fallback/Receive** | Rejects accidental ETH transfers |
| **PoA Consensus** | Hardhat's instant auto-mining |

## How Modules Connect

1. **Blockchain ↔ Backend**: Backend connects via ethers.js to deployed contracts on Hardhat node
2. **Backend ↔ Frontend**: REST API calls from React app to Express server
3. **Frontend ↔ Blockchain**: Indirect via backend; frontend doesn't directly interact with contracts
4. **Contracts**: APILogger imports and uses APIKeyRegistry for access control
5. **Merkle Operations**: Backend manages off-chain Merkle trees, stores roots on-chain

## Running the Project

### Prerequisites
- Node.js
- npm

### Steps
1. **Start Blockchain**: `npm run chain` (Terminal 1, port 8545)
2. **Deploy Contracts**: `npm run deploy` (Terminal 2)
3. **Start Backend**: `npm run backend` (Terminal 2, port 3001)
4. **Start Frontend**: `npm run frontend` (Terminal 3, port 5173)

### Testing
- `npm test`: Run contract tests

## Security and Design Patterns

- **Access Control**: Owner-only functions, registered user checks
- **Emergency Stop**: Circuit breaker pattern
- **Hash Integrity**: SHA-256 + hash chaining
- **Merkle Proofs**: Efficient batch verification
- **Event Logging**: Transparent audit trail
- **Fee Management**: Withdrawal pattern for collected ETH
- **Input Validation**: Require statements and modifiers

## File Structure Summary

```
bc_project/
├── contracts/           # Solidity smart contracts
├── backend/            # Express API server
├── frontend/           # React DApp
├── ignition/           # Deployment scripts
├── test/              # Contract tests
├── artifacts/         # Compiled contracts
├── cache/             # Solidity cache
├── hardhat.config.js  # Hardhat configuration
├── package.json       # Root dependencies and scripts
└── README.md          # Project overview
```

This system demonstrates practical blockchain application for audit logging, combining cryptographic security with user-friendly interfaces.