// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title ReputationRegistry
/// @notice Lightweight, ERC-8004-inspired reputation events for AI agents.
///         Tracks the realized PnL of a Pick after the underlying Polymarket
///         market resolves. The PickLedger emits the *recommendation*; this
///         contract emits what *actually happened*.
///
///         Events are append-only. The agent attests its own resolution; for
///         a stronger trust model an attestor multisig or oracle-driven
///         resolver can be wired in later — same event surface.
contract ReputationRegistry {
    /// @param agent      Agent address (matches PickLedger.Pick.agent).
    /// @param pickId     PickLedger id this resolution refers to.
    /// @param marketId   Polymarket conditionId.
    /// @param outcome    Resolved outcome (0 = Yes wins, 1 = No wins, 2 = 50/50).
    /// @param agentSide  Side the agent recommended (0 = Yes, 1 = No).
    /// @param hit        true if agentSide matches the resolved outcome.
    /// @param pnlBP      Realized PnL in basis points of notional (signed).
    ///                   For a winning bet at price `p`: pnl = (1-p)/p * notional.
    /// @param notionalUSDC6 Notional in USDC 6-decimals at the time of the recommendation.
    /// @param attestor   Who is making the attestation (often the agent itself).
    event Reputation(
        address indexed agent,
        uint256 indexed pickId,
        bytes32 indexed marketId,
        uint8 outcome,
        uint8 agentSide,
        bool hit,
        int32 pnlBP,
        uint256 notionalUSDC6,
        address attestor
    );

    /// Aggregate snapshot, optionally posted by the agent or a trusted indexer
    /// after a batch resolution. Useful for periodic public summaries.
    event TrackRecord(
        address indexed agent,
        uint64 totalPicks,
        uint64 resolved,
        uint64 hits,
        int64 cumulativePnLBP
    );

    function attestResolution(
        uint256 pickId,
        bytes32 marketId,
        uint8 outcome,
        uint8 agentSide,
        int32 pnlBP,
        uint256 notionalUSDC6
    ) external {
        bool hit = (outcome == agentSide);
        emit Reputation(
            msg.sender, pickId, marketId, outcome, agentSide, hit, pnlBP, notionalUSDC6, msg.sender
        );
    }

    function postTrackRecord(
        uint64 totalPicks,
        uint64 resolved,
        uint64 hits,
        int64 cumulativePnLBP
    ) external {
        emit TrackRecord(msg.sender, totalPicks, resolved, hits, cumulativePnLBP);
    }
}
