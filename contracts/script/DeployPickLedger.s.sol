// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {PickLedger} from "../src/PickLedger.sol";

contract DeployPickLedger is Script {
    function run() external returns (PickLedger ledger) {
        uint256 pk = vm.envUint("AGENT_PRIVATE_KEY");
        vm.startBroadcast(pk);
        ledger = new PickLedger();
        console.log("PickLedger deployed at:", address(ledger));
        vm.stopBroadcast();
    }
}
