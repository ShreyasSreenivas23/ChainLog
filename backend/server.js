/**
 * Secure & Immutable API Usage Logging System
 * Backend Middleware / API Gateway
 *
 * This Express server acts as an API proxy that:
 *  1. Intercepts every API call
 *  2. Computes SHA-256 hash of the request (Unit 1)
 *  3. Logs the call immutably to the blockchain (Unit 2: Smart Contracts)
 *  4. Builds Merkle trees for batch verification (Unit 1: Merkle Tree)
 *  5. Exposes REST endpoints for the frontend DApp
 */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { ethers } = require("ethers");
const MerkleHelper = require("./merkle");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = 3001;
const HARDHAT_RPC = "http://127.0.0.1:8545";

// Load deployment info
let deploymentInfo = null;
let loggerContract = null;
let registryContract = null;
let provider = null;
let signers = [];

// connexts backend to the deployed smart contract

async function loadContracts() {
  try {
    const deployPath = path.join(__dirname, "deployment.json");
    if (!fs.existsSync(deployPath)) {
      console.warn("⚠️  deployment.json not found. Run: npx hardhat run ignition/modules/deploy.js --network localhost");
      return false;
    }

    deploymentInfo = JSON.parse(fs.readFileSync(deployPath, "utf8"));

    // connect to blockchain
    provider = new ethers.providers.JsonRpcProvider(HARDHAT_RPC);

    // Load ABIs
    // ABIs are contract interfaces - how to call functions in the contract
    const loggerABI = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "artifacts", "contracts", "APILogger.sol", "APILogger.json"),
        "utf8"
      )
    ).abi;
    const registryABI = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "artifacts", "contracts", "APIKeyRegistry.sol", "APIKeyRegistry.json"),
        "utf8"
      )
    ).abi;

    // Use account[0] as default signer (contract owner)
    const accounts = await provider.listAccounts();

    // we get the signers, they sign the wallet
    signers = await Promise.all(
      accounts.slice(0, 5).map((addr) => provider.getSigner(addr))
    );

    // contract insatances
    loggerContract = new ethers.Contract(
      deploymentInfo.contracts.APILogger.address,
      loggerABI,
      signers[0]
    );

      // api registering
    registryContract = new ethers.Contract(
      deploymentInfo.contracts.APIKeyRegistry.address,
      registryABI,
      signers[0]
    );

    console.log("✅ Contracts loaded:");
    console.log("   APILogger:", deploymentInfo.contracts.APILogger.address);
    console.log("   APIKeyRegistry:", deploymentInfo.contracts.APIKeyRegistry.address);
    return true;
  } catch (err) {
    console.error("❌ Failed to load contracts:", err.message);
    return false;
  }
}

// ── Merkle Helper (in-memory for current batch) ───────────────────────────────
const merkleHelper = new MerkleHelper();

// ── In-Memory Log Cache (for fast frontend queries) ───────────────────────────
const logCache = [];
const batchCache = [];

// ── Simulated API Services ────────────────────────────────────────────────────
const API_SERVICES = {
  payment: {
    name: "Payment Gateway",
    endpoints: [
      { path: "/api/v1/payment/charge", method: "POST", avgTime: 145 },
      { path: "/api/v1/payment/refund", method: "POST", avgTime: 203 },
      { path: "/api/v1/payment/balance", method: "GET", avgTime: 67 },
      { path: "/api/v1/payment/history", method: "GET", avgTime: 89 },
    ],
  },
  ai: {
    name: "AI/ML Platform",
    endpoints: [
      { path: "/api/v1/ai/completion", method: "POST", avgTime: 892 },
      { path: "/api/v1/ai/embedding", method: "POST", avgTime: 234 },
      { path: "/api/v1/ai/classify", method: "POST", avgTime: 156 },
      { path: "/api/v1/ai/summarize", method: "POST", avgTime: 445 },
    ],
  },
  weather: {
    name: "Weather Data API",
    endpoints: [
      { path: "/api/v1/weather/current", method: "GET", avgTime: 67 },
      { path: "/api/v1/weather/forecast", method: "GET", avgTime: 123 },
      { path: "/api/v1/weather/historical", method: "GET", avgTime: 345 },
    ],
  },
  geo: {
    name: "Geolocation Service",
    endpoints: [
      { path: "/api/v1/geo/geocode", method: "POST", avgTime: 89 },
      { path: "/api/v1/geo/reverse", method: "GET", avgTime: 76 },
    ],
  },
};

// ── SHA-256 Request Hashing (Unit 1: Hash Functions) ─────────────────────────
function hashRequest(method, endpoint, body, timestamp) {
  const data = JSON.stringify({ method, endpoint, body: body || {}, timestamp });
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

// ── Simulate API Call + Log to Blockchain ────────────────────────────────────
async function simulateAndLog(signerIndex, endpoint, method, body = {}) {
  const startTime = Date.now();
  const timestamp = startTime;

  // Simulate API processing time
  const service = Object.values(API_SERVICES)
    .flatMap((s) => s.endpoints)
    .find((e) => e.path === endpoint);

  const baseTime = service ? service.avgTime : 100;
  const responseTime = baseTime + Math.floor(Math.random() * 50) - 25;

  // Simulate occasional failures
  const statusCodes = [200, 200, 200, 200, 201, 400, 429, 500];
  const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];

  // Compute SHA-256 hash of request (Unit 1 concept)
  const requestHash = hashRequest(method, endpoint, body, timestamp);

  let logId = null;
  let txHash = null;
  let logHash = null;

  if (loggerContract && signers[signerIndex]) {
    try {
      const signer = signers[signerIndex];
      const loggerWithSigner = loggerContract.connect(signer);

      const tx = await loggerWithSigner.logAPICall(
        endpoint,
        method,
        statusCode,
        responseTime,
        requestHash,
        ""
      );
      const receipt = await tx.wait();

      // Extract log ID from event
      const event = receipt.logs.find(
        (log) => log.topics[0] === ethers.id("LogRecorded(uint256,address,string,uint256,bytes32,uint256)")
      );

      if (event) {
        const decoded = loggerContract.interface.parseLog(event);
        logId = decoded.args[0].toString();
        logHash = decoded.args[4];
      }

      txHash = receipt.hash;
    } catch (err) {
      console.error("Chain log error:", err.message);
    }
  }

  const logEntry = {
    id: logId || `local-${logCache.length}`,
    caller: signers[signerIndex] ? (await signers[signerIndex].getAddress()) : "0x0",
    endpoint,
    method,
    statusCode,
    responseTimeMs: responseTime,
    requestHash,
    logHash: logHash || "0x" + crypto.randomBytes(32).toString("hex"),
    txHash,
    timestamp: Math.floor(timestamp / 1000),
    service: Object.entries(API_SERVICES).find(([, s]) =>
      s.endpoints.some((e) => e.path === endpoint)
    )?.[0] || "unknown",
  };

  logCache.push(logEntry);

  // Add to Merkle tree
  merkleHelper.addLeaf(logEntry);

  return logEntry;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    contractsLoaded: !!loggerContract,
    totalCachedLogs: logCache.length,
    merkleLeaves: merkleHelper.getLeaves().length,
    timestamp: new Date().toISOString(),
  });
});

// Get contract addresses
app.get("/api/deployment", (req, res) => {
  res.json(deploymentInfo || { error: "Contracts not deployed yet" });
});

// Get all available API services
app.get("/api/services", (req, res) => {
  res.json(API_SERVICES);
});

// Simulate an API call (main demo endpoint)
app.post("/api/simulate", async (req, res) => {
  try {
    const { endpoint, method = "GET", signerIndex = 1, body = {} } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: "endpoint is required" });
    }

    const result = await simulateAndLog(signerIndex, endpoint, method, body);
    res.json({
      success: true,
      log: result,
      merkleRoot: merkleHelper.getRoot(),
      totalLogs: logCache.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate a random API call
app.post("/api/simulate/random", async (req, res) => {
  try {
    const { signerIndex = 1 } = req.body;
    const allEndpoints = Object.values(API_SERVICES).flatMap((s) => s.endpoints);
    const picked = allEndpoints[Math.floor(Math.random() * allEndpoints.length)];

    const result = await simulateAndLog(signerIndex, picked.path, picked.method);
    res.json({
      success: true,
      log: result,
      merkleRoot: merkleHelper.getRoot(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cached logs (fast, no chain query needed)
app.get("/api/logs", (req, res) => {
  const { page = 0, limit = 20, caller, endpoint, status } = req.query;

  let filtered = [...logCache];
  if (caller) filtered = filtered.filter((l) => l.caller.toLowerCase() === caller.toLowerCase());
  if (endpoint) filtered = filtered.filter((l) => l.endpoint.includes(endpoint));
  if (status) filtered = filtered.filter((l) => l.statusCode === parseInt(status));

  const start = parseInt(page) * parseInt(limit);
  const paginated = filtered.slice(start, start + parseInt(limit));

  res.json({
    logs: paginated.reverse(),
    total: filtered.length,
    page: parseInt(page),
    pages: Math.ceil(filtered.length / parseInt(limit)),
  });
});

// Get logs from blockchain
app.get("/api/logs/chain", async (req, res) => {
  if (!loggerContract) {
    return res.status(503).json({ error: "Contracts not loaded" });
  }
  try {
    const total = await loggerContract.totalLogs();
    if (total === 0n) {
      return res.json({ logs: [], total: 0 });
    }

    const count = Math.min(Number(total), 50);
    const start = Math.max(0, Number(total) - count);
    const logs = await loggerContract.getLogsInRange(start, Number(total) - 1);

    res.json({
      logs: logs.map((l) => ({
        id: l.id.toString(),
        caller: l.caller,
        endpoint: l.endpoint,
        method: l.method,
        timestamp: l.timestamp.toString(),
        statusCode: l.statusCode.toString(),
        responseTimeMs: l.responseTimeMs.toString(),
        requestHash: l.requestHash,
        prevLogHash: l.prevLogHash,
        logHash: l.logHash,
        ipfsMetadataHash: l.ipfsMetadataHash,
      })),
      total: total.toString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Merkle tree info
app.get("/api/merkle", (req, res) => {
  res.json({
    root: merkleHelper.getRoot(),
    leaves: merkleHelper.getLeaves().map((l, i) => ({
      index: i,
      sha256Hash: l.sha256Hash,
      leaf: l.leaf,
    })),
    leafCount: merkleHelper.getLeaves().length,
    treeVisualization: merkleHelper.getTreeVisualization(),
  });
});

// Get Merkle proof for a specific leaf
app.get("/api/merkle/proof/:index", (req, res) => {
  const index = parseInt(req.params.index);
  const proof = merkleHelper.getProof(index);
  if (!proof) {
    return res.status(404).json({ error: "Leaf not found" });
  }
  res.json(proof);
});

// Verify a Merkle proof
app.post("/api/merkle/verify", (req, res) => {
  const { proof, leaf, root } = req.body;
  const isValid = merkleHelper.verify(proof, leaf, root);
  res.json({ valid: isValid, root, leaf });
});

// Get registered consumers from chain
app.get("/api/consumers", async (req, res) => {
  if (!registryContract) {
    return res.status(503).json({ error: "Contracts not loaded" });
  }
  try {
    const addresses = await registryContract.getAllConsumers();
    const consumers = await Promise.all(
      addresses.map(async (addr) => {
        const c = await registryContract.getConsumer(addr);
        return {
          address: addr,
          name: c.name,
          organization: c.organization,
          isActive: c.isActive,
          callCount: c.callCount.toString(),
          registeredAt: c.registeredAt.toString(),
        };
      })
    );
    res.json({ consumers, total: consumers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get blockchain stats
app.get("/api/stats", async (req, res) => {
  if (!loggerContract) {
    return res.json({
      totalLogs: logCache.length,
      totalBatches: 0,
      contractsLoaded: false,
    });
  }
  try {
    const totalLogs = await loggerContract.totalLogs();
    const totalBatches = await loggerContract.totalBatches();
    const pendingBatch = await loggerContract.getPendingBatchSize();
    const latestRoot = await loggerContract.getLatestMerkleRoot();

    res.json({
      totalLogs: totalLogs.toString(),
      totalBatches: totalBatches.toString(),
      pendingBatchSize: pendingBatch.toString(),
      latestMerkleRoot: latestRoot,
      contractsLoaded: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register a new API consumer (admin)
app.post("/api/consumers/register", async (req, res) => {
  if (!registryContract) {
    return res.status(503).json({ error: "Contracts not loaded" });
  }
  try {
    const { address, name, organization } = req.body;
    const tx = await registryContract.adminRegister(address, name, organization);
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke an API key
app.post("/api/consumers/revoke", async (req, res) => {
  if (!registryContract) {
    return res.status(503).json({ error: "Contracts not loaded" });
  }
  try {
    const { address } = req.body;
    const tx = await registryContract.revokeKey(address);
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Force finalize current batch
app.post("/api/batch/finalize", async (req, res) => {
  if (!loggerContract) {
    return res.status(503).json({ error: "Contracts not loaded" });
  }
  try {
    const pending = await loggerContract.getPendingBatchSize();
    if (pending === 0n) {
      return res.status(400).json({ error: "No pending logs to finalize" });
    }
    const tx = await loggerContract.finalizeBatch();
    const receipt = await tx.wait();

    // Reset local Merkle helper
    merkleHelper.reset();

    const totalBatches = await loggerContract.totalBatches();
    const latestBatch = await loggerContract.getBatch(Number(totalBatches) - 1);

    res.json({
      success: true,
      batchId: latestBatch.batchId.toString(),
      merkleRoot: latestBatch.merkleRoot,
      logCount: latestBatch.logCount.toString(),
      txHash: receipt.hash,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all batches from chain
app.get("/api/batches", async (req, res) => {
  if (!loggerContract) {
    return res.json({ batches: [], total: 0 });
  }
  try {
    const total = await loggerContract.totalBatches();
    const batches = [];
    for (let i = 0; i < Number(total); i++) {
      const b = await loggerContract.getBatch(i);
      batches.push({
        batchId: b.batchId.toString(),
        startLogId: b.startLogId.toString(),
        endLogId: b.endLogId.toString(),
        merkleRoot: b.merkleRoot,
        finalizedAt: b.finalizedAt.toString(),
        logCount: b.logCount.toString(),
      });
    }
    res.json({ batches, total: total.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────
async function start() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("   Secure & Immutable API Usage Logging — Backend");
  console.log("═══════════════════════════════════════════════════════════");

  await loadContracts();

  app.listen(PORT, () => {
    console.log(`\n🚀 Backend running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Logs:   http://localhost:${PORT}/api/logs`);
    console.log(`   Stats:  http://localhost:${PORT}/api/stats`);
    console.log("\n   Ready to receive API calls!\n");
  });
}

start();
