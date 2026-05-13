# ChainLog — Project Explanation

## Does It Deploy a Local Blockchain?

**Yes, absolutely.** The project runs a **local Ethereum blockchain** using **Hardhat Node**.

When you run `npm run chain` (which maps to `npx hardhat node`), Hardhat spins up a **full in-memory Ethereum node** at `http://127.0.0.1:8545` with:
- **Chain ID**: 31337
- **20 pre-funded accounts** (each with 10,000 ETH of fake test ETH)
- **Auto-mining**: every transaction is instantly mined into a block (no waiting)
- **Full EVM**: the same Ethereum Virtual Machine that runs on mainnet

> [!IMPORTANT]
> The blockchain is **ephemeral** — all data is lost when you stop the Hardhat node. This is by design for development/demo purposes. No real ETH or mainnet interaction occurs.

---

## High-Level Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌───────────────────────┐
│   React Frontend    │────▶│  Express Backend  │────▶│   Hardhat Blockchain  │
│   (Vite, :5173)     │◀────│    (:3001)        │◀────│   (localhost:8545)    │
└─────────────────────┘     └──────────────────┘     └───────────────────────┘
       5 Pages               API Gateway +                2 Smart Contracts
                              Merkle Tree                 + Hash Chain
```

The system has **3 layers**, each running in its own terminal:

| Layer | Command | Port | Role |
|-------|---------|------|------|
| Blockchain | `npm run chain` | 8545 | Local Ethereum node |
| Backend | `npm run backend` | 3001 | Express API gateway, talks to blockchain |
| Frontend | `npm run frontend` | 5173 | React DApp (Vite) |

A 4th one-time command (`npm run deploy`) deploys the smart contracts to the local chain.

---

## What the Project Does

**ChainLog** is a **Secure & Immutable API Usage Logging System**. It demonstrates how blockchain can solve the problem of tamper-proof audit logging.

### The Problem
Traditional API logs are stored in centralized databases — they can be modified, deleted, or forged. If a billing dispute arises between an API provider and consumer, there's no trusted source of truth.

### The Solution
Every API call is recorded **on-chain** (on the Ethereum blockchain). Once written, logs **cannot be modified or deleted**. Each log is cryptographically linked to the previous one (hash chain), and batches of logs are bundled into **Merkle trees** for efficient verification.

---

## Smart Contracts (On-Chain Logic)

### 1. [APIKeyRegistry.sol](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/contracts/APIKeyRegistry.sol)

**Purpose**: Access control — manages who is allowed to log API calls.

| Feature | Details |
|---------|---------|
| Consumer registration | Stores name, org, wallet, timestamps |
| Admin registration | Owner can register consumers without fee |
| Registration fee | Supports a payable `register()` with a fee (in ETH) |
| Key revocation | Owner can revoke/reactivate any consumer's access |
| Call count tracking | Each consumer's total API calls are tracked |
| Fee collection | Owner can withdraw accumulated registration fees |

**Key modifiers**: `onlyOwner`, `onlyActive`

### 2. [APILogger.sol](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/contracts/APILogger.sol)

**Purpose**: The core logging contract — stores immutable, hash-chained API usage logs.

| Feature | Details |
|---------|---------|
| `logAPICall()` | Writes a log with endpoint, method, status code, response time, and a SHA-256 request hash |
| **Hash chain** | Each log stores `prevLogHash`, creating a tamper-evident linked list |
| **Merkle batching** | Every 10 logs are grouped into a Merkle tree; the root is stored on-chain |
| Duplicate detection | Prevents logging the same hash twice |
| Integrity verification | `verifyLogIntegrity()` recomputes the hash to check for tampering |
| Merkle proof verification | `verifyLogInBatch()` verifies a log's inclusion in a batch via Merkle proof |
| Emergency stop | `setPaused()` allows the owner to halt all logging |
| **Fallback/Receive** | Rejects any ETH sent to the contract |
| Usage summaries | Tracks per-caller success/failure rates and average response times |

**Data stored per log**:
```
id, caller, endpoint, method, timestamp, statusCode,
responseTimeMs, requestHash, prevLogHash, logHash, ipfsMetadataHash
```

---

## Backend Middleware

### [server.js](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/backend/server.js)

An **Express.js API gateway** that acts as the bridge between the frontend and the blockchain.

**Key responsibilities:**
1. **Loads deployed contracts** from `deployment.json` + compiled ABIs
2. **Simulates API calls** — picks from predefined services (Payment, AI, Weather, Geo) with realistic response times
3. **Hashes each request** using SHA-256 before sending to the chain
4. **Manages the Merkle tree** in-memory using `merkletreejs` for fast proof generation
5. **Caches logs** in-memory for fast frontend queries
6. **Exposes REST endpoints** for the frontend

**REST API Routes:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Server status check |
| `/api/simulate` | POST | Simulate a specific API call → logs on-chain |
| `/api/simulate/random` | POST | Simulate a random API call |
| `/api/logs` | GET | Fetch cached logs (with pagination + filtering) |
| `/api/logs/chain` | GET | Fetch logs directly from blockchain |
| `/api/merkle` | GET | Get current Merkle tree state + visualization |
| `/api/merkle/proof/:index` | GET | Get Merkle proof for a specific log |
| `/api/merkle/verify` | POST | Verify a Merkle proof |
| `/api/consumers` | GET | List registered API consumers from chain |
| `/api/consumers/register` | POST | Admin-register a new consumer |
| `/api/consumers/revoke` | POST | Revoke a consumer's API key |
| `/api/stats` | GET | Blockchain statistics (total logs, batches, etc.) |
| `/api/batches` | GET | List all finalized Merkle batches |
| `/api/batch/finalize` | POST | Force-finalize current pending batch |

### [merkle.js](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/backend/merkle.js)

A helper class wrapping the `merkletreejs` library:
- **Double-hashes** each log (SHA-256 → keccak256) for security
- Rebuilds the Merkle tree on each new leaf
- Generates proofs and verifies them
- Provides a text visualization of the tree structure

---

## Frontend DApp

A **React + Vite** single-page application with 5 pages:

| Page | File | Purpose |
|------|------|---------|
| **Dashboard** | [Dashboard.jsx](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/frontend/src/pages/Dashboard.jsx) | Overview stats — total logs, batches, contract status, live indicators |
| **Simulate API** | [Simulate.jsx](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/frontend/src/pages/Simulate.jsx) | Fire simulated API calls (pick service/endpoint or random), see results logged on-chain |
| **Log Explorer** | [LogExplorer.jsx](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/frontend/src/pages/LogExplorer.jsx) | Browse all logged API calls with filtering and pagination |
| **Merkle Verifier** | [MerkleVerify.jsx](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/frontend/src/pages/MerkleVerify.jsx) | Visualize Merkle tree, generate/verify proofs for individual logs |
| **API Consumers** | [Consumers.jsx](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/frontend/src/pages/Consumers.jsx) | Manage registered consumers — register, revoke, view call counts |

The app uses a sidebar navigation with a dark theme and live backend status indicators.

---

## Deployment Script

### [deploy.js](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/ignition/modules/deploy.js)

Runs against the local Hardhat node and performs:

1. **Deploys `APIKeyRegistry`** with a 0.001 ETH registration fee
2. **Deploys `APILogger`** linked to the registry
3. **Registers 3 demo consumers** (PaymentService, AIMLPlatform, WeatherDataAPI) using Hardhat test accounts
4. **Logs 5 demo API calls** to pre-populate the system
5. **Saves `deployment.json`** with contract addresses (read by both backend and frontend)
6. **Copies ABIs** to `frontend/src/contracts/` for the DApp

---

## Blockchain Concepts Demonstrated

| Concept | Where It's Used |
|---------|----------------|
| **SHA-256 Hashing** | Every API request body is hashed before logging ([server.js](file:///c:/Xhreyas/COLLEGE/SEM%206/BC/LAB/bc_project/backend/server.js) `hashRequest()`) |
| **Hash Pointers / Chain** | Each log stores `prevLogHash`, creating a linked chain of hashes (tamper-evident) |
| **Merkle Trees** | Batches of 10 logs → Merkle root stored on-chain; off-chain proofs via `merkletreejs` |
| **Smart Contracts** | Two Solidity contracts deployed to Hardhat (local Ethereum) |
| **Immutability** | On-chain data cannot be modified or deleted |
| **Access Control** | `onlyRegistered` modifier enforces only registered consumers can log |
| **CIA Triad** | **Confidentiality** (access control), **Integrity** (hash chain + Merkle), **Availability** (DApp) |
| **Emergency Stop** | `setPaused()` halts logging — a security pattern |
| **Events** | `LogRecorded`, `BatchFinalized`, etc. emitted for off-chain auditability |
| **Fallback/Receive** | Contract rejects accidental ETH transfers |
| **Structs & Mappings** | `APILog`, `MerkleBatch`, `UsageSummary` structs; multiple mappings |
| **View/Pure Functions** | Read-only chain queries + pure hash computation |
| **PoA Consensus** | Hardhat uses Proof-of-Authority (auto-mining) for instant confirmation |

---

## How to Run (Full Flow)

```bash
# Terminal 1 — Start local blockchain
npm run chain

# Terminal 2 — Deploy contracts + seed demo data
npm run deploy

# Terminal 2 — Start backend API server
npm run backend

# Terminal 3 — Start frontend dev server
npm run frontend
```

Then open **http://localhost:5173** → Dashboard → Simulate API calls → View logs → Verify Merkle proofs.

---

## Current Status

Looking at your running terminals, you have `npm run backend` and `npm run frontend` running. However, **you also need `npm run chain` running in a separate terminal** for the blockchain node, and you need to have run `npm run deploy` at least once to deploy the contracts. Without the chain running, the backend will show a warning about `deployment.json` not found or will fail to connect to the blockchain.
