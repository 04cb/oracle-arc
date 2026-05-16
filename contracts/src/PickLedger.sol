// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title PickLedger
/// @notice Append-only on-chain feed of AI-agent prediction-market picks.
///         No state is stored — picks are emitted as events. The off-chain
///         reasoning trace lives at `reasoningURI`, hashed by `reasoningHash`,
///         so anyone can verify "agent X recommended outcome Y at block N
///         with reasoning that hashes to H."
contract PickLedger {
    /// @dev Once an agent address is registered it can publish picks.
    ///      Registration is permissionless — first transaction from a new
    ///      address auto-registers. `name` is metadata only, not unique.
    event AgentRegistered(address indexed agent, string name);

    /// @param id          Monotonically increasing per-agent id.
    /// @param marketId    Polymarket condition id (bytes32).
    /// @param tokenId     The specific outcome token being recommended (uint256 from Polymarket).
    /// @param side        0 = BUY (long the outcome), 1 = SELL (short it).
    /// @param probBP      Agent's estimated probability in basis points (0..10000).
    /// @param edgeBP      Estimated edge over market price, in basis points (signed).
    /// @param kellyFracBP Agent's Kelly position size as a fraction, in basis points.
    /// @param reasoningHash sha256 of the full reasoning blob.
    /// @param reasoningURI Where to fetch the reasoning blob (ipfs://, https://, ar://).
    /// @param expiresAt   Pick is invalid after this unix timestamp.
    event Pick(
        address indexed agent,
        uint256 indexed id,
        bytes32 indexed marketId,
        uint256 tokenId,
        uint8 side,
        uint16 probBP,
        int16 edgeBP,
        uint16 kellyFracBP,
        bytes32 reasoningHash,
        string reasoningURI,
        uint64 expiresAt
    );

    /// @dev Optional after-the-fact metadata link from a pick to the Polymarket fill(s) it produced.
    event FillAttribution(
        address indexed agent,
        uint256 indexed pickId,
        bytes32 polymarketTradeId,
        uint256 fillSize,
        uint256 builderFeeUSDC6 // USDC has 6 decimals
    );

    mapping(address => bool) public registered;
    mapping(address => uint256) public nextId;

    error AlreadyRegistered();
    error NotRegistered();
    error InvalidProbability();
    error InvalidKelly();
    error ExpiryInPast();

    function register(string calldata name) external {
        if (registered[msg.sender]) revert AlreadyRegistered();
        registered[msg.sender] = true;
        emit AgentRegistered(msg.sender, name);
    }

    function publish(
        bytes32 marketId,
        uint256 tokenId,
        uint8 side,
        uint16 probBP,
        int16 edgeBP,
        uint16 kellyFracBP,
        bytes32 reasoningHash,
        string calldata reasoningURI,
        uint64 expiresAt
    ) external returns (uint256 id) {
        if (!registered[msg.sender]) revert NotRegistered();
        if (probBP > 10000) revert InvalidProbability();
        if (kellyFracBP > 10000) revert InvalidKelly();
        if (expiresAt <= block.timestamp) revert ExpiryInPast();

        id = nextId[msg.sender]++;
        emit Pick(
            msg.sender,
            id,
            marketId,
            tokenId,
            side,
            probBP,
            edgeBP,
            kellyFracBP,
            reasoningHash,
            reasoningURI,
            expiresAt
        );
    }

    function attestFill(
        uint256 pickId,
        bytes32 polymarketTradeId,
        uint256 fillSize,
        uint256 builderFeeUSDC6
    ) external {
        if (!registered[msg.sender]) revert NotRegistered();
        emit FillAttribution(msg.sender, pickId, polymarketTradeId, fillSize, builderFeeUSDC6);
    }
}
