// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./APIKeyRegistry.sol";

// Hash Chaining + Merkle Batching + on-chain storage

/**
 * @title APILogger
 * @dev Core contract for immutable, tamper-resistant API usage logging.
 *
 * Blockchain Concepts Demonstrated:
 *  - Unit 1: Hash pointers (each log links to previous log hash), Merkle tree roots,
 *            SHA-256 via keccak256, Public Ledger, Immutability
 *  - Unit 2: Smart contract deployment, PoA consensus (Hardhat network)
 *  - Unit 3: Structs, Mappings, Modifiers, Events, view/pure, restricted access,
 *            fallback, ether units, withdrawal pattern
 *  - Unit 4: CIA triad (Integrity via immutability, Confidentiality via access control,
 *            Availability via decentralization), smart contract security
 */
contract APILogger {
    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant BATCH_SIZE = 10; // Merkle batch size

    // ─── State Variables ──────────────────────────────────────────────────────
    address public owner;
    APIKeyRegistry public registry;

    uint256 public totalLogs;
    uint256 public totalBatches;
    bytes32 public latestLogHash;   // Hash pointer to latest log (Unit 1 concept)

    // ─── Structs (Unit 3) ─────────────────────────────────────────────────────
    struct APILog {
        uint256 id;
        address caller;           // Who made the API call
        string endpoint;          // Which API endpoint was called
        string method;            // HTTP method (GET, POST, etc.)
        uint256 timestamp;        // When the call was made
        uint256 statusCode;       // HTTP response status
        uint256 responseTimeMs;   // Response time in milliseconds
        bytes32 requestHash;      // SHA-256 of request payload (Unit 1: hashing)
        bytes32 prevLogHash;      // Hash pointer to previous log (Unit 1: hash pointer)
        bytes32 logHash;          // Hash of this entire log entry
        string ipfsMetadataHash;  // Optional IPFS reference for extended data
        bool exists;
    }

    struct MerkleBatch {
        uint256 batchId;
        uint256 startLogId;
        uint256 endLogId;
        bytes32 merkleRoot;       // Merkle root of batch (Unit 1: Merkle tree)
        uint256 finalizedAt;
        uint256 logCount;
    }

    struct UsageSummary {
        uint256 totalCalls;
        uint256 successCalls;
        uint256 failedCalls;
        uint256 avgResponseTime;
        uint256 lastCallTimestamp;
    }

    // ─── Mappings (Unit 3) ────────────────────────────────────────────────────
    mapping(uint256 => APILog) public logs;                          // logId => Log
    mapping(bytes32 => bool) public logHashExists;                   // Duplicate detection
    mapping(bytes32 => uint256) public hashToLogId;                  // Hash => logId
    mapping(address => uint256[]) public callerLogs;                 // caller => logIds
    mapping(string => uint256[]) public endpointLogs;                // endpoint => logIds
    mapping(uint256 => MerkleBatch) public batches;                  // batchId => Batch
    mapping(address => UsageSummary) public usageSummaries;          // caller => summary
    mapping(bytes32 => bytes32[]) public merkleProofs;               // root => proofs

    // ─── Arrays ───────────────────────────────────────────────────────────────
    uint256[] private currentBatchLogIds;
    bytes32[] private currentBatchHashes;

    // ─── Events ───────────────────────────────────────────────────────────────
    event LogRecorded(
        uint256 indexed logId,
        address indexed caller,
        string endpoint,
        uint256 statusCode,
        bytes32 logHash,
        uint256 timestamp
    );
    event BatchFinalized(
        uint256 indexed batchId,
        bytes32 merkleRoot,
        uint256 logCount,
        uint256 timestamp
    );
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event EmergencyStop(bool stopped, address triggeredBy);

    // ─── Security State ───────────────────────────────────────────────────────
    bool public paused;

    // ─── Modifiers (Unit 3: modifiers) ───────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "APILogger: not owner");
        _;
    }

    modifier onlyRegistered() {
        require(
            address(registry) == address(0) || registry.checkAccess(msg.sender),
            "APILogger: caller not registered"
        );
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "APILogger: contract is paused");
        _;
    }

    modifier validEndpoint(string calldata endpoint) {
        require(bytes(endpoint).length > 0, "APILogger: empty endpoint");
        require(bytes(endpoint).length <= 256, "APILogger: endpoint too long");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _registry) {
        owner = msg.sender;
        registry = APIKeyRegistry(_registry);
        paused = false;
        latestLogHash = bytes32(0);
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /**
     * @dev Record an API call on-chain immutably.
     *      Each log is linked to the previous via hash pointer (Unit 1 concept).
     * @param _endpoint   The API endpoint that was called
     * @param _method     HTTP method string
     * @param _statusCode HTTP response status code
     * @param _responseTimeMs Response time in milliseconds
     * @param _requestHash SHA-256 hash of the request payload (computed off-chain)
     * @param _ipfsRef    Optional IPFS hash for extended metadata
     */
    function logAPICall(
        string calldata _endpoint,
        string calldata _method,
        uint256 _statusCode,
        uint256 _responseTimeMs,
        bytes32 _requestHash,
        string calldata _ipfsRef
    )
        external
        onlyRegistered
        whenNotPaused
        validEndpoint(_endpoint)
        returns (uint256 logId)
    {
        logId = totalLogs;

        // Compute log hash — chaining with previous hash (Unit 1: Hash Pointer)
        bytes32 logHash = keccak256(
            abi.encodePacked(
                logId,
                msg.sender,
                _endpoint,
                _method,
                block.timestamp,
                _statusCode,
                _responseTimeMs,
                _requestHash,
                latestLogHash   // ← hash pointer links to previous log
            )
        );

        // Prevent duplicate log hashes
        require(!logHashExists[logHash], "APILogger: duplicate log detected");

        // Store the log
        logs[logId] = APILog({
            id: logId,
            caller: msg.sender,
            endpoint: _endpoint,
            method: _method,
            timestamp: block.timestamp,
            statusCode: _statusCode,
            responseTimeMs: _responseTimeMs,
            requestHash: _requestHash,
            prevLogHash: latestLogHash,
            logHash: logHash,
            ipfsMetadataHash: _ipfsRef,
            exists: true
        });

        // Update state
        logHashExists[logHash] = true;
        hashToLogId[logHash] = logId;
        callerLogs[msg.sender].push(logId);
        endpointLogs[_endpoint].push(logId);
        latestLogHash = logHash;
        totalLogs++;

        // Update caller usage summary
        _updateUsageSummary(msg.sender, _statusCode, _responseTimeMs);

        // Update registry call count
        if (address(registry) != address(0)) {
            try registry.incrementCallCount(msg.sender) {} catch {}
        }

        // Add to current Merkle batch
        currentBatchLogIds.push(logId);
        currentBatchHashes.push(logHash);

        // Auto-finalize batch when full
        if (currentBatchLogIds.length >= BATCH_SIZE) {
            _finalizeBatch();
        }

        emit LogRecorded(logId, msg.sender, _endpoint, _statusCode, logHash, block.timestamp);
        return logId;
    }

    /**
     * @dev Manually finalize current batch and compute Merkle root
     *      Only owner can force-finalize (for demo purposes)
     */
    function finalizeBatch() external onlyOwner {
        require(currentBatchLogIds.length > 0, "APILogger: no logs to finalize");
        _finalizeBatch();
    }

    /**
     * @dev Verify that a log hash is included in a batch's Merkle tree.
     *      Demonstrates Merkle tree proof verification (Unit 1).
     * @param _logHash    The hash of the log to verify
     * @param _batchId    The batch to verify against
     * @param _proof      Merkle proof (sibling hashes from leaf to root)
     * @param _isLeft     Array indicating if proof element is left sibling
     */
    function verifyLogInBatch(
        bytes32 _logHash,
        uint256 _batchId,
        bytes32[] calldata _proof,
        bool[] calldata _isLeft
    ) external view returns (bool) {
        require(_batchId < totalBatches, "APILogger: batch does not exist");
        require(_proof.length == _isLeft.length, "APILogger: proof length mismatch");

        bytes32 computedRoot = _logHash;
        for (uint256 i = 0; i < _proof.length; i++) {
            if (_isLeft[i]) {
                computedRoot = keccak256(abi.encodePacked(_proof[i], computedRoot));
            } else {
                computedRoot = keccak256(abi.encodePacked(computedRoot, _proof[i]));
            }
        }

        return computedRoot == batches[_batchId].merkleRoot;
    }

    /**
     * @dev Emergency pause (Unit 4: security / CIA triad)
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyStop(_paused, msg.sender);
    }

    /**
     * @dev Transfer ownership (restricted access pattern)
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "APILogger: zero address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    // ─── View Functions (Unit 3: view/pure) ──────────────────────────────────

    /**
     * @dev Get a specific log by ID
     */
    function getLog(uint256 _logId) external view returns (APILog memory) {
        require(_logId < totalLogs, "APILogger: log does not exist");
        return logs[_logId];
    }

    /**
     * @dev Get all log IDs for a caller
     */
    function getCallerLogs(address _caller) external view returns (uint256[] memory) {
        return callerLogs[_caller];
    }

    /**
     * @dev Get all log IDs for an endpoint
     */
    function getEndpointLogs(string calldata _endpoint) external view returns (uint256[] memory) {
        return endpointLogs[_endpoint];
    }

    /**
     * @dev Get usage summary for a caller
     */
    function getUsageSummary(address _caller) external view returns (UsageSummary memory) {
        return usageSummaries[_caller];
    }

    /**
     * @dev Get a batch by ID
     */
    function getBatch(uint256 _batchId) external view returns (MerkleBatch memory) {
        require(_batchId < totalBatches, "APILogger: batch does not exist");
        return batches[_batchId];
    }

    /**
     * @dev Get the latest Merkle root
     */
    function getLatestMerkleRoot() external view returns (bytes32) {
        if (totalBatches == 0) return bytes32(0);
        return batches[totalBatches - 1].merkleRoot;
    }

    /**
     * @dev Get pending (unfinalized) batch log count
     */
    function getPendingBatchSize() external view returns (uint256) {
        return currentBatchLogIds.length;
    }

    /**
     * @dev Verify a log has not been tampered with by recomputing its hash
     *      Pure Merkle verification without proof (direct integrity check)
     */
    function verifyLogIntegrity(uint256 _logId) external view returns (bool) {
        require(_logId < totalLogs, "APILogger: log does not exist");
        APILog memory log = logs[_logId];

        // Get the previous log hash for chain verification
        bytes32 prevHash = _logId == 0 ? bytes32(0) : logs[_logId - 1].logHash;

        bytes32 recomputedHash = keccak256(
            abi.encodePacked(
                log.id,
                log.caller,
                log.endpoint,
                log.method,
                log.timestamp,
                log.statusCode,
                log.responseTimeMs,
                log.requestHash,
                prevHash
            )
        );

        return recomputedHash == log.logHash;
    }

    /**
     * @dev Get multiple logs in a range (for pagination)
     */
    function getLogsInRange(uint256 _start, uint256 _end) 
        external 
        view 
        returns (APILog[] memory) 
    {
        require(_start <= _end, "APILogger: invalid range");
        require(_end < totalLogs, "APILogger: range out of bounds");

        uint256 count = _end - _start + 1;
        APILog[] memory result = new APILog[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = logs[_start + i];
        }
        return result;
    }

    /**
     * @dev Pure function: compute hash of API request data (demonstrates pure functions)
     */
    function computeRequestHash(
        string calldata _body,
        string calldata _headers,
        uint256 _nonce
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_body, _headers, _nonce));
    }

    // ─── Fallback (Unit 3: fallback) ─────────────────────────────────────────
    receive() external payable {
        revert("APILogger: does not accept ETH");
    }

    fallback() external payable {
        revert("APILogger: unknown function call");
    }

    // ─── Internal Functions ───────────────────────────────────────────────────

    /**
     * @dev Build Merkle root from current batch hashes and store it.
     *      Simplified Merkle tree computation on-chain (Unit 1: Merkle tree).
     */
    function _finalizeBatch() internal {
        uint256 startId = currentBatchLogIds[0];
        uint256 endId = currentBatchLogIds[currentBatchLogIds.length - 1];
        uint256 logCount = currentBatchLogIds.length;

        // Build Merkle tree from hashes
        bytes32 merkleRoot = _computeMerkleRoot(currentBatchHashes);

        // Store batch
        batches[totalBatches] = MerkleBatch({
            batchId: totalBatches,
            startLogId: startId,
            endLogId: endId,
            merkleRoot: merkleRoot,
            finalizedAt: block.timestamp,
            logCount: logCount
        });

        emit BatchFinalized(totalBatches, merkleRoot, logCount, block.timestamp);

        totalBatches++;

        // Reset current batch
        delete currentBatchLogIds;
        delete currentBatchHashes;
    }

    /**
     * @dev Compute Merkle root from an array of leaf hashes.
     *      Demonstrates Merkle tree construction (Unit 1).
     */
    function _computeMerkleRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        uint256 n = leaves.length;
        if (n == 0) return bytes32(0);
        if (n == 1) return leaves[0];

        while (n > 1) {
            uint256 newN = (n + 1) / 2;
            bytes32[] memory newLeaves = new bytes32[](newN);
            for (uint256 i = 0; i < n; i += 2) {
                if (i + 1 < n) {
                    newLeaves[i / 2] = keccak256(abi.encodePacked(leaves[i], leaves[i + 1]));
                } else {
                    // Odd leaf: duplicate it (standard Merkle tree behavior)
                    newLeaves[i / 2] = keccak256(abi.encodePacked(leaves[i], leaves[i]));
                }
            }
            leaves = newLeaves;
            n = newN;
        }

        return leaves[0];
    }

    /**
     * @dev Update usage summary for a caller
     */
    function _updateUsageSummary(
        address _caller,
        uint256 _statusCode,
        uint256 _responseTimeMs
    ) internal {
        UsageSummary storage summary = usageSummaries[_caller];
        summary.totalCalls++;
        summary.lastCallTimestamp = block.timestamp;

        if (_statusCode >= 200 && _statusCode < 300) {
            summary.successCalls++;
        } else {
            summary.failedCalls++;
        }

        // Running average of response time
        if (summary.totalCalls == 1) {
            summary.avgResponseTime = _responseTimeMs;
        } else {
            summary.avgResponseTime =
                (summary.avgResponseTime * (summary.totalCalls - 1) + _responseTimeMs) /
                summary.totalCalls;
        }
    }
}
