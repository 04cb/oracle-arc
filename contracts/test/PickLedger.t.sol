// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {PickLedger} from "../src/PickLedger.sol";

contract PickLedgerTest is Test {
    PickLedger ledger;

    function setUp() public {
        ledger = new PickLedger();
    }

    function test_RegisterThenPublish() public {
        ledger.register("test-agent");
        assertTrue(ledger.registered(address(this)));

        uint256 id = ledger.publish(
            bytes32(uint256(1)),
            123,
            0,
            6200,
            300,
            500,
            bytes32(uint256(0xabc)),
            "ipfs://Qm.../reasoning.json",
            uint64(block.timestamp + 1 days)
        );
        assertEq(id, 0);
        assertEq(ledger.nextId(address(this)), 1);
    }

    function test_RevertWhenNotRegistered() public {
        vm.expectRevert(PickLedger.NotRegistered.selector);
        ledger.publish(
            bytes32(uint256(1)), 0, 0, 5000, 0, 0,
            bytes32(0), "", uint64(block.timestamp + 1)
        );
    }

    function test_RevertOnInvalidProbability() public {
        ledger.register("x");
        vm.expectRevert(PickLedger.InvalidProbability.selector);
        ledger.publish(
            bytes32(uint256(1)), 0, 0, 10001, 0, 0,
            bytes32(0), "", uint64(block.timestamp + 1)
        );
    }

    function test_RevertOnExpiredPick() public {
        ledger.register("x");
        vm.expectRevert(PickLedger.ExpiryInPast.selector);
        ledger.publish(
            bytes32(uint256(1)), 0, 0, 5000, 0, 0,
            bytes32(0), "", uint64(block.timestamp)
        );
    }
}
