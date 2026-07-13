// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test helper: a contract that rejects any incoming ETH, used to exercise
/// the escrow's pull-payment fallback path.
contract RejectEther {
    receive() external payable {
        revert("no ether");
    }
}
