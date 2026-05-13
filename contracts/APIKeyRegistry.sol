// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title APIKeyRegistry
 * @dev Manages registration and revocation of API consumers
 *      Demonstrates: Restricted Access, Modifiers, Mappings, Events (Unit 3)
 *                    Permissioned Blockchain model (Unit 1)
 */
contract APIKeyRegistry {
    // ─── State Variables ──────────────────────────────────────────────────────
    address public owner;
    uint256 public registrationFee; // in wei — demonstrates ether units (Unit 3)
    uint256 public totalKeys;

    struct APIConsumer {
        address wallet;
        string name;
        string organization;
        uint256 registeredAt;
        bool isActive;
        uint256 callCount;
        uint256 totalFeePaid;
    }

    // mapping(address => APIConsumer) — Unit 3 concept
    mapping(address => APIConsumer) public consumers;
    mapping(address => bool) public isRegistered;

    address[] private consumerList;

    // ─── Events ───────────────────────────────────────────────────────────────
    event KeyRegistered(address indexed wallet, string name, uint256 timestamp);
    event KeyRevoked(address indexed wallet, uint256 timestamp);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Registry: caller is not the owner");
        _;
    }

    modifier onlyActive() {
        require(isRegistered[msg.sender], "Registry: caller is not registered");
        require(consumers[msg.sender].isActive, "Registry: API key is revoked");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(uint256 _registrationFee) {
        owner = msg.sender;
        registrationFee = _registrationFee;
        // Auto-register the owner
        _registerConsumer(msg.sender, "Admin", "System");
    }

    // ─── External Functions ───────────────────────────────────────────────────

    /**
     * @dev Register as an API consumer by paying the registration fee
     */
    function register(string calldata _name, string calldata _organization) external payable {
        require(!isRegistered[msg.sender], "Registry: already registered");
        require(msg.value >= registrationFee, "Registry: insufficient registration fee");
        _registerConsumer(msg.sender, _name, _organization);
        consumers[msg.sender].totalFeePaid += msg.value;
    }

    /**
     * @dev Admin: register a consumer without fee (for testing/onboarding)
     */
    function adminRegister(
        address _wallet,
        string calldata _name,
        string calldata _organization
    ) external onlyOwner {
        require(!isRegistered[_wallet], "Registry: already registered");
        _registerConsumer(_wallet, _name, _organization);
    }

    /**
     * @dev Revoke an API consumer's key (restricted access pattern)
     */
    function revokeKey(address _wallet) external onlyOwner {
        require(isRegistered[_wallet], "Registry: not registered");
        consumers[_wallet].isActive = false;
        emit KeyRevoked(_wallet, block.timestamp);
    }

    /**
     * @dev Reactivate a revoked key
     */
    function reactivateKey(address _wallet) external onlyOwner {
        require(isRegistered[_wallet], "Registry: not registered");
        consumers[_wallet].isActive = true;
        emit KeyRegistered(_wallet, consumers[_wallet].name, block.timestamp);
    }

    /**
     * @dev Increment call count — called by APILogger
     */
    function incrementCallCount(address _wallet) external {
        if (isRegistered[_wallet]) {
            consumers[_wallet].callCount++;
        }
    }

    /**
     * @dev Update registration fee (owner only)
     */
    function updateFee(uint256 _newFee) external onlyOwner {
        emit FeeUpdated(registrationFee, _newFee);
        registrationFee = _newFee;
    }

    /**
     * @dev Withdraw collected fees
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Registry: no fees to withdraw");
        payable(owner).transfer(balance);
    }

    // ─── View Functions (view/pure) ──────────────────────────────────

    function getConsumer(address _wallet) external view returns (APIConsumer memory) {
        return consumers[_wallet];
    }

    function getAllConsumers() external view returns (address[] memory) {
        return consumerList;
    }

    function getTotalConsumers() external view returns (uint256) {
        return consumerList.length;
    }

    function checkAccess(address _wallet) external view returns (bool) {
        return isRegistered[_wallet] && consumers[_wallet].isActive;
    }

    // ─── Internal Functions ───────────────────────────────────────────────────

    function _registerConsumer(
        address _wallet,
        string memory _name,
        string memory _organization
    ) internal {
        consumers[_wallet] = APIConsumer({
            wallet: _wallet,
            name: _name,
            organization: _organization,
            registeredAt: block.timestamp,
            isActive: true,
            callCount: 0,
            totalFeePaid: 0
        });
        isRegistered[_wallet] = true;
        consumerList.push(_wallet);
        totalKeys++;
        emit KeyRegistered(_wallet, _name, block.timestamp);
    }
}
