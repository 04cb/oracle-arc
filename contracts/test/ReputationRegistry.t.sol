// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry reg;

    function setUp() public {
        reg = new ReputationRegistry();
    }

    function test_AttestResolution_Hit() public {
        // expected event ordering
        vm.expectEmit(true, true, true, true);
        emit ReputationRegistry.Reputation(
            address(this),                 // agent
            42,                            // pickId
            bytes32(uint256(0xabc)),       // marketId
            1,                             // outcome (No wins)
            1,                             // agentSide (No)
            true,                          // hit
            6400,                          // pnlBP
            100_000_000,                   // notional USDC 6-dec (= $100)
            address(this)                  // attestor
        );
        reg.attestResolution(42, bytes32(uint256(0xabc)), 1, 1, 6400, 100_000_000);
    }

    function test_AttestResolution_Miss() public {
        vm.expectEmit(true, true, true, true);
        emit ReputationRegistry.Reputation(
            address(this), 1, bytes32(uint256(1)), 0, 1, false, -10000, 0, address(this)
        );
        reg.attestResolution(1, bytes32(uint256(1)), 0, 1, -10000, 0);
    }

    function test_PostTrackRecord() public {
        vm.expectEmit(true, false, false, true);
        emit ReputationRegistry.TrackRecord(address(this), 50, 12, 8, 23400);
        reg.postTrackRecord(50, 12, 8, 23400);
    }
}
