const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
const [deployer] = await hre.ethers.getSigners();

console.log("═══════════════════════════════════════════════════════════");
console.log("   Secure & Immutable API Usage Logging System");
console.log("   Deploying to:", hre.network.name);
console.log("═══════════════════════════════════════════════════════════");
console.log("Deployer address:", deployer.address);

const balance = await hre.ethers.provider.getBalance(deployer.address);
console.log("Deployer balance:", hre.ethers.utils.formatEther(balance), "ETH\n");

// ── 1. Deploy APIKeyRegistry ─────────────────────────────────────────────
const registrationFee = hre.ethers.utils.parseEther("0.001"); // 0.001 ETH fee
console.log("1. Deploying APIKeyRegistry...");

const RegistryFactory = await hre.ethers.getContractFactory("APIKeyRegistry");
const registry = await RegistryFactory.deploy(registrationFee);
await registry.deployed();

const registryAddress = registry.address;
console.log("   ✅ APIKeyRegistry deployed at:", registryAddress);

// ── 2. Deploy APILogger ───────────────────────────────────────────────────
console.log("\n2. Deploying APILogger...");

const LoggerFactory = await hre.ethers.getContractFactory("APILogger");
const logger = await LoggerFactory.deploy(registryAddress);
await logger.deployed();

const loggerAddress = logger.address;
console.log("   ✅ APILogger deployed at:", loggerAddress);

// ── 3. Register some demo API consumers ──────────────────────────────────
console.log("\n3. Registering demo API consumers...");

const accounts = await hre.ethers.getSigners();

if (accounts.length > 1) {
await registry.adminRegister(accounts[1].address, "PaymentService", "FinTech Corp");
console.log("   ✅ Registered accounts[1] as PaymentService");
}

if (accounts.length > 2) {
await registry.adminRegister(accounts[2].address, "AIMLPlatform", "AI Corp");
console.log("   ✅ Registered accounts[2] as AIMLPlatform");
}

if (accounts.length > 3) {
await registry.adminRegister(accounts[3].address, "WeatherDataAPI", "DataSystems Inc");
console.log("   ✅ Registered accounts[3] as WeatherDataAPI");
}

// ── 4. Log some demo API calls ────────────────────────────────────────────
console.log("\n4. Logging demo API calls...");

const demoLogs = [
{
signer: accounts[1],
endpoint: "/api/v1/payment/charge",
method: "POST",
status: 200,
responseTime: 145,
},
{
signer: accounts[2],
endpoint: "/api/v1/ai/completion",
method: "POST",
status: 200,
responseTime: 892,
},
{
signer: accounts[3],
endpoint: "/api/v1/weather/current",
method: "GET",
status: 200,
responseTime: 67,
},
{
signer: accounts[1],
endpoint: "/api/v1/payment/refund",
method: "POST",
status: 200,
responseTime: 203,
},
{
signer: accounts[2],
endpoint: "/api/v1/ai/embedding",
method: "POST",
status: 429,
responseTime: 12,
},
];

for (const demo of demoLogs) {
if (!demo.signer) continue;

const requestHash = hre.ethers.utils.keccak256(
  hre.ethers.utils.toUtf8Bytes(
    JSON.stringify({ endpoint: demo.endpoint, ts: Date.now() })
  )
);

const loggerConnected = logger.connect(demo.signer);

const tx = await loggerConnected.logAPICall(
  demo.endpoint,
  demo.method,
  demo.status,
  demo.responseTime,
  requestHash,
  ""
);

await tx.wait();

console.log(`   ✅ Logged: ${demo.method} ${demo.endpoint} → ${demo.status}`);

}

// ── 5. Save deployment info ───────────────────────────────────────────────
const deploymentInfo = {
network: hre.network.name,
chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
deployedAt: new Date().toISOString(),
deployer: deployer.address,
contracts: {
APIKeyRegistry: {
address: registryAddress,
registrationFee: hre.ethers.utils.formatEther(registrationFee),
},
APILogger: {
address: loggerAddress,
batchSize: "10",
},
},
demoAccounts: accounts.slice(0, 5).map((a, i) => ({
index: i,
address: a.address,
})),
};

const outPath = path.join(__dirname, "..", "deployment.json");
fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
console.log("\n5. Deployment info saved to deployment.json");

// Also save to frontend
const frontendPath = path.join(__dirname, "..", "frontend", "src", "contracts");
if (!fs.existsSync(frontendPath)) fs.mkdirSync(frontendPath, { recursive: true });

fs.writeFileSync(
path.join(frontendPath, "deployment.json"),
JSON.stringify(deploymentInfo, null, 2)
);

// Copy ABIs
const artifactsBasePath = path.join(__dirname, "..", "..", "artifacts", "contracts");

const loggerABI = JSON.parse(
fs.readFileSync(
path.join(artifactsBasePath, "APILogger.sol", "APILogger.json"),
"utf8"
)
);

const registryABI = JSON.parse(
fs.readFileSync(
path.join(artifactsBasePath, "APIKeyRegistry.sol", "APIKeyRegistry.json"),
"utf8"
)
);

fs.writeFileSync(
path.join(frontendPath, "APILogger.json"),
JSON.stringify({ abi: loggerABI.abi }, null, 2)
);

fs.writeFileSync(
path.join(frontendPath, "APIKeyRegistry.json"),
JSON.stringify({ abi: registryABI.abi }, null, 2)
);

console.log("   ✅ ABIs copied to frontend/src/contracts/");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("   🎉 Deployment Complete!");
console.log("═══════════════════════════════════════════════════════════");
console.log("   APIKeyRegistry:", registryAddress);
console.log("   APILogger:     ", loggerAddress);
console.log("\n   Next steps:");
console.log("   1. cd frontend && npm install && npm run dev");
console.log("   2. Import a Hardhat account into MetaMask");
console.log("   3. Set network to localhost:8545 (Chain ID: 31337)");
console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
console.error("Deployment failed:", err);
process.exitCode = 1;
});
