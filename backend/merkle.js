const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const crypto = require("crypto");

/**
 * MerkleHelper — deterministic & verification-safe version
 */
class MerkleHelper {
  constructor() {
    this.leaves = [];
    this.rawData = [];
    this.tree = null;
  }

  /**
   * Create deterministic data (VERY IMPORTANT)
   */
  _getStableData(logData) {
    return {
      method: logData.method,
      endpoint: logData.endpoint,
      status: logData.status,
      responseTime: logData.responseTime,
      caller: logData.caller,
    };
  }

  /**
   * Add a log entry → create leaf
   */
  addLeaf(logData) {
    const stableData = this._getStableData(logData);

    const serialized = JSON.stringify(stableData);

    // Step 1: SHA-256
    const sha256Hash = crypto
      .createHash("sha256")
      .update(serialized)
      .digest("hex");

    // Step 2: keccak256 (final leaf) ; a ethereum specific hash
    const leaf = keccak256(Buffer.from(sha256Hash, "hex"));

    this.leaves.push(leaf);

    this.rawData.push({
      stableData,
      sha256Hash,
      leaf: leaf.toString("hex"),
    });

    this._rebuild();

    return leaf.toString("hex"); // return FINAL leaf (important)
  }

  /**
   * Build Merkle tree
   */

  // Leaves → pair → hash → repeat → root
  // uses an inbuilt module
  _rebuild() {
    if (this.leaves.length === 0) {
      this.tree = null;
      return;
    }

    this.tree = new MerkleTree(this.leaves, keccak256, {
      sortPairs: true, // ✅ IMPORTANT for consistency
      duplicateOdd: true,
    });
  }

  /**
   * Get root
   */
  getRoot() {
    if (!this.tree || this.leaves.length === 0) return null;
    return this.tree.getHexRoot();
  }

  /**
   * Get proof for a leaf index
   */
  getProof(index) {
    if (!this.tree || index >= this.leaves.length) return null;

    const leaf = this.leaves[index];
    const proof = this.tree.getHexProof(leaf);

    return {
      leaf: leaf.toString("hex"),
      proof,
      root: this.getRoot(),
      index,
    };
  }

  /**
   * Verify proof
   */
  verify(proof, leaf, root) {
    if (!this.tree) return false;

    const leafBuf = Buffer.from(leaf.replace("0x", ""), "hex");

    return this.tree.verify(proof, leafBuf, root);
  }

  /**
   * Get all leaves
   */
  getLeaves() {
    return this.rawData;
  }

  /**
   * Tree visualization
   */
  getTreeVisualization() {
    if (!this.tree) return "Empty tree";
    return this.tree.toString();
  }

  /**
   * Reset tree
   */
  reset() {
    this.leaves = [];
    this.rawData = [];
    this.tree = null;
  }
}

module.exports = MerkleHelper;