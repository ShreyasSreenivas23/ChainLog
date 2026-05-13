# ChainLog — Secure & Immutable API Usage Logging System

A blockchain-powered, tamper-resistant API usage logging system using Ethereum smart contracts, Merkle trees, and SHA-256 cryptographic hashing.

## Architecture

```
┌─────────────────┐    ┌────────────────┐    ┌──────────────────────┐
│  React Frontend │◄──►│ Express Backend │◄──►│  Hardhat Blockchain  │
│  (Vite, :5173)  │    │   (:3001)      │    │  (Localhost :8545)   │
└─────────────────┘    └────────────────┘    └──────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │  APILogger.sol     │  ← Immutable logs, hash chain
                    │  APIKeyRegistry.sol│  ← Access control
                    └────────────────────┘
```

## Quick Start

### Step 1 — Start Hardhat Node (Terminal 1)
```bash
npm run chain
```

### Step 2 — Deploy Contracts (Terminal 2)
```bash
npm run deploy
```

### Step 3 — Start Backend (Terminal 2, after deploy)
```bash
npm run backend
```

### Step 4 — Start Frontend (Terminal 3)
```bash
npm run frontend
```

Open **http://localhost:5173** in your browser.

## Running Tests

```bash
npm test
```

## Blockchain Concepts Covered

| Concept | Implementation |
|---|---|
| SHA-256 Hashing | Every API request is hashed before logging |
| Hash Pointers | Each log stores `prevLogHash`, creating a tamper-evident chain |
| Merkle Trees | Batches of 10 logs are grouped into a Merkle tree; root stored on-chain |
| Smart Contracts | `APILogger.sol` + `APIKeyRegistry.sol` on Hardhat |
| Immutability | Logs stored on-chain cannot be modified or deleted |
| Access Control | `onlyRegistered` modifier rejects unregistered callers |
| CIA Triad | Integrity (hash chain), Confidentiality (access control), Availability (DApp) |
| Emergency Stop | `setPaused()` allows owner to halt logging |
| Events | `LogRecorded` + `BatchFinalized` emitted for auditability |
| Fallback | Contract rejects ETH transfers |
