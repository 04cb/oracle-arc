// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract DeployReputation is Script {
    function run() external returns (ReputationRegistry reg) {
        uint256 pk = vm.envUint("AGENT_PRIVATE_KEY");
        vm.startBroadcast(pk);
        reg = new ReputationRegistry();
        console.log("ReputationRegistry deployed at:", address(reg));
        vm.stopBroadcast();
    }
}
