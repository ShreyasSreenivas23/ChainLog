const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Comprehensive test suite for Secure & Immutable API Usage Logging System
 * Covers: Unit 1 (hashing, Merkle trees), Unit 3 (Solidity features), Unit 4 (security)
 */
describe("Secure & Immutable API Usage Logging System", function () {
  let registry, logger;
  let owner, user1, user2, user3, unauthorized;

  const REGISTRATION_FEE = ethers.parseEther("0.001");
  const ZERO_BYTES32 = ethers.ZeroHash;

  // Helper: create a fake request hash
  const makeRequestHash = (data) =>
    ethers.keccak256(ethers.toUtf8Bytes(data));

  // Helper: log a single API call
  async function logCall(signer, endpoint, method = "GET", status = 200, responseTime = 100) {
    const reqHash = makeRequestHash(`${endpoint}-${Date.now()}-${Math.random()}`);
    return logger.connect(signer).logAPICall(endpoint, method, status, responseTime, reqHash, "");
  }

  beforeEach(async function () {
    [owner, user1, user2, user3, unauthorized] = await ethers.getSigners();

    // Deploy APIKeyRegistry
    const RegistryFactory = await ethers.getContractFactory("APIKeyRegistry");
    registry = await RegistryFactory.deploy(REGISTRATION_FEE);
    await registry.waitForDeployment();

    // Deploy APILogger
    const LoggerFactory = await ethers.getContractFactory("APILogger");
    logger = await LoggerFactory.deploy(await registry.getAddress());
    await logger.waitForDeployment();

    // Register users
    await registry.adminRegister(user1.address, "User1", "OrgA");
    await registry.adminRegister(user2.address, "User2", "OrgB");
    await registry.adminRegister(user3.address, "User3", "OrgC");
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe("APIKeyRegistry — Permissioned Access", function () {
    it("should register owner automatically on deploy", async function () {
      const consumer = await registry.getConsumer(owner.address);
      expect(consumer.isActive).to.be.true;
      expect(consumer.name).to.equal("Admin");
    });

    it("should allow owner to register new consumers", async function () {
      expect(await registry.isRegistered(user1.address)).to.be.true;
      const consumer = await registry.getConsumer(user1.address);
      expect(consumer.name).to.equal("User1");
      expect(consumer.organization).to.equal("OrgA");
    });

    it("should allow self-registration with fee", async function () {
      const [, , , , , newUser] = await ethers.getSigners();
      await registry.connect(newUser).register("NewUser", "NewOrg", {
        value: REGISTRATION_FEE,
      });
      expect(await registry.isRegistered(newUser.address)).to.be.true;
    });

    it("should reject self-registration with insufficient fee", async function () {
      const [, , , , , newUser] = await ethers.getSigners();
      await expect(
        registry.connect(newUser).register("NewUser", "NewOrg", {
          value: ethers.parseEther("0.0001"),
        })
      ).to.be.revertedWith("Registry: insufficient registration fee");
    });

    it("should prevent double registration", async function () {
      await expect(
        registry.adminRegister(user1.address, "Dup", "OrgDup")
      ).to.be.revertedWith("Registry: already registered");
    });

    it("should allow owner to revoke and reactivate keys", async function () {
      await registry.revokeKey(user1.address);
      expect((await registry.getConsumer(user1.address)).isActive).to.be.false;
      expect(await registry.checkAccess(user1.address)).to.be.false;

      await registry.reactivateKey(user1.address);
      expect(await registry.checkAccess(user1.address)).to.be.true;
    });

    it("should reject registration from non-owner", async function () {
      const [, , , , , newUser] = await ethers.getSigners();
      await expect(
        registry.connect(user1).adminRegister(newUser.address, "Bad", "Org")
      ).to.be.revertedWith("Registry: caller is not the owner");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe("APILogger — Core Logging", function () {
    it("should log an API call and emit LogRecorded event", async function () {
      const reqHash = makeRequestHash("test-payload");
      const tx = await logger
        .connect(user1)
        .logAPICall("/api/test", "GET", 200, 100, reqHash, "");

      await expect(tx)
        .to.emit(logger, "LogRecorded")
        .withArgs(
          0n,
          user1.address,
          "/api/test",
          200n,
          (v) => typeof v === "string", // logHash
          (v) => typeof v === "bigint"  // timestamp
        );
    });

    it("should store log correctly on-chain", async function () {
      const reqHash = makeRequestHash("payload-1");
      await logger.connect(user1).logAPICall("/api/payment", "POST", 201, 250, reqHash, "");

      const log = await logger.getLog(0);
      expect(log.caller).to.equal(user1.address);
      expect(log.endpoint).to.equal("/api/payment");
      expect(log.method).to.equal("POST");
      expect(log.statusCode).to.equal(201n);
      expect(log.responseTimeMs).to.equal(250n);
      expect(log.requestHash).to.equal(reqHash);
      expect(log.exists).to.be.true;
    });

    it("should correctly set hash pointer (link to previous log)", async function () {
      await logCall(user1, "/api/first");
      await logCall(user2, "/api/second");

      const log0 = await logger.getLog(0);
      const log1 = await logger.getLog(1);

      // First log's prevHash is zero (genesis)
      expect(log0.prevLogHash).to.equal(ZERO_BYTES32);

      // Second log's prevHash equals first log's hash — HASH POINTER
      expect(log1.prevLogHash).to.equal(log0.logHash);
    });

    it("should verify log integrity (hash verification)", async function () {
      await logCall(user1, "/api/integrity-test");
      const isValid = await logger.verifyLogIntegrity(0);
      expect(isValid).to.be.true;
    });

    it("should block unregistered callers", async function () {
      const reqHash = makeRequestHash("unauth");
      await expect(
        logger.connect(unauthorized).logAPICall("/api/hack", "GET", 200, 10, reqHash, "")
      ).to.be.revertedWith("APILogger: caller not registered");
    });

    it("should block revoked users from logging", async function () {
      await registry.revokeKey(user1.address);
      const reqHash = makeRequestHash("revoked");
      await expect(
        logger.connect(user1).logAPICall("/api/blocked", "GET", 200, 10, reqHash, "")
      ).to.be.revertedWith("APILogger: caller not registered");
    });

    it("should reject empty endpoint", async function () {
      const reqHash = makeRequestHash("test");
      await expect(
        logger.connect(user1).logAPICall("", "GET", 200, 10, reqHash, "")
      ).to.be.revertedWith("APILogger: empty endpoint");
    });

    it("should track caller logs", async function () {
      await logCall(user1, "/api/one");
      await logCall(user2, "/api/two");
      await logCall(user1, "/api/three");

      const user1Logs = await logger.getCallerLogs(user1.address);
      expect(user1Logs.length).to.equal(2);

      const user2Logs = await logger.getCallerLogs(user2.address);
      expect(user2Logs.length).to.equal(1);
    });

    it("should update usage summary correctly", async function () {
      await logCall(user1, "/api/x", "GET", 200, 100);
      await logCall(user1, "/api/y", "GET", 500, 200);

      const summary = await logger.getUsageSummary(user1.address);
      expect(summary.totalCalls).to.equal(2n);
      expect(summary.successCalls).to.equal(1n);
      expect(summary.failedCalls).to.equal(1n);
      expect(summary.avgResponseTime).to.equal(150n); // (100+200)/2
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe("Merkle Tree — Batch Finalization (Unit 1)", function () {
    it("should finalize a batch manually", async function () {
      for (let i = 0; i < 3; i++) {
        await logCall(user1, `/api/endpoint-${i}`);
      }

      const tx = await logger.connect(owner).finalizeBatch();
      await expect(tx).to.emit(logger, "BatchFinalized");

      expect(await logger.totalBatches()).to.equal(1n);
      const batch = await logger.getBatch(0);
      expect(batch.logCount).to.equal(3n);
      expect(batch.merkleRoot).to.not.equal(ZERO_BYTES32);
    });

    it("should auto-finalize batch after 10 logs", async function () {
      // Log 10 calls — should trigger auto-finalization
      for (let i = 0; i < 10; i++) {
        await logCall(i % 3 === 0 ? user1 : i % 3 === 1 ? user2 : user3, `/api/batch-${i}`);
      }

      expect(await logger.totalBatches()).to.equal(1n);
      expect(await logger.getPendingBatchSize()).to.equal(0n);
    });

    it("should produce consistent Merkle root for same logs", async function () {
      for (let i = 0; i < 5; i++) {
        await logCall(user1, `/api/consistent-${i}`);
      }
      await logger.connect(owner).finalizeBatch();

      const batch = await logger.getBatch(0);
      expect(batch.merkleRoot).to.not.equal(ZERO_BYTES32);

      // Root should be deterministic — verify it's stored
      const root = await logger.getLatestMerkleRoot();
      expect(root).to.equal(batch.merkleRoot);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe("Security Features (Unit 4)", function () {
    it("should pause and unpause logging (emergency stop)", async function () {
      await logger.connect(owner).setPaused(true);
      const reqHash = makeRequestHash("paused");
      await expect(
        logger.connect(user1).logAPICall("/api/x", "GET", 200, 10, reqHash, "")
      ).to.be.revertedWith("APILogger: contract is paused");

      await logger.connect(owner).setPaused(false);
      // Should work now
      await expect(
        logger.connect(user1).logAPICall("/api/x", "GET", 200, 10, reqHash, "")
      ).to.emit(logger, "LogRecorded");
    });

    it("should reject ETH transfers (fallback protection)", async function () {
      await expect(
        user1.sendTransaction({
          to: await logger.getAddress(),
          value: ethers.parseEther("1"),
        })
      ).to.be.reverted;
    });

    it("should only allow owner to finalize batches", async function () {
      await logCall(user1, "/api/test");
      await expect(
        logger.connect(user1).finalizeBatch()
      ).to.be.revertedWith("APILogger: not owner");
    });

    it("should only allow owner to pause contract", async function () {
      await expect(
        logger.connect(user1).setPaused(true)
      ).to.be.revertedWith("APILogger: not owner");
    });

    it("should allow owner transfer", async function () {
      await logger.connect(owner).transferOwnership(user1.address);
      expect(await logger.owner()).to.equal(user1.address);
    });

    it("should compute deterministic request hash (pure function)", async function () {
      const hash1 = await logger.computeRequestHash("body", "headers", 42n);
      const hash2 = await logger.computeRequestHash("body", "headers", 42n);
      expect(hash1).to.equal(hash2);

      const hash3 = await logger.computeRequestHash("body", "headers", 43n);
      expect(hash1).to.not.equal(hash3);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe("Pagination and Query", function () {
    beforeEach(async function () {
      for (let i = 0; i < 5; i++) {
        await logCall(user1, `/api/page-${i}`);
      }
    });

    it("should return logs in range", async function () {
      const logs = await logger.getLogsInRange(0, 4);
      expect(logs.length).to.equal(5);
      expect(logs[0].endpoint).to.equal("/api/page-0");
      expect(logs[4].endpoint).to.equal("/api/page-4");
    });

    it("should return correct total log count", async function () {
      expect(await logger.totalLogs()).to.equal(5n);
    });
  });
});
