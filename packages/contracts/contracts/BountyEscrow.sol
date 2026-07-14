// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BountyEscrow
 * @notice Escrow for on-chain bounties on Robinhood Chain (native ETH rewards).
 *
 * Lifecycle:
 *   create() [+ETH]  ->  OPEN
 *   OPEN --submit()-->   OPEN (hunters register proofs on-chain)
 *   OPEN --approve()-->  PAID       (creator pays a hunter, minus platform fee)
 *   OPEN --cancel()-->   CANCELLED  (creator refunded; only while no submissions)
 *   OPEN --reclaim()-->  RECLAIMED  (creator refunded after deadline + dispute window)
 *   OPEN --dispute()-->  DISPUTED   (a hunter contests before the window closes)
 *   DISPUTED --resolve()-> PAID | RECLAIMED  (arbiter decides)
 *
 * Money is the on-chain source of truth; rich content (descriptions, proof media)
 * lives off-chain and is anchored here by keccak256 hashes for integrity.
 */
contract BountyEscrow is Ownable, ReentrancyGuard {
    /* -------------------------------------------------------------------------- */
    /*                                   Types                                    */
    /* -------------------------------------------------------------------------- */

    enum Status {
        Open,
        Paid,
        Cancelled,
        Reclaimed,
        Disputed
    }

    struct Bounty {
        address creator;
        uint96 reward; // in wei; uint96 covers ~7.9e28 wei, far beyond any real reward
        address winner; // hunter paid on approval / dispute resolution
        uint64 deadline; // unix seconds; submissions accepted until here
        Status status;
        // Terms below are snapshotted at creation so later owner config changes
        // never apply retroactively to funds already in escrow.
        uint16 feeBps; // fee rate this bounty pays out at (MAX_FEE_BPS fits uint16)
        uint32 submissionCount;
        uint64 disputeWindow; // seconds hunters have to dispute after the deadline
        bytes32 metadataHash; // keccak256 of the off-chain bounty document
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Storage                                   */
    /* -------------------------------------------------------------------------- */

    uint256 public constant MAX_FEE_BPS = 1000; // hard cap: platform fee can never exceed 10%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    uint256 public nextBountyId = 1;
    uint256 public feeBps; // fee in bps applied to bounties created from now on
    uint256 public minReward; // minimum reward accepted at creation (anti-dust)
    uint64 public disputeWindow; // dispute window applied to bounties created from now on
    address public feeRecipient;
    address public arbiter; // resolves disputes; distinct from owner for separation of duties

    mapping(uint256 => Bounty) public bounties;
    // Whether an address has an active on-chain submission for a bounty.
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    // Pull-payment credits for transfers that failed (e.g. contract recipients that revert).
    mapping(address => uint256) public pendingWithdrawals;

    /* -------------------------------------------------------------------------- */
    /*                                   Events                                   */
    /* -------------------------------------------------------------------------- */

    event BountyCreated(
        uint256 indexed id,
        address indexed creator,
        uint256 reward,
        uint64 deadline,
        bytes32 metadataHash
    );
    event SubmissionCreated(uint256 indexed id, address indexed hunter, bytes32 proofHash);
    event BountyApproved(uint256 indexed id, address indexed winner, uint256 payout, uint256 fee);
    event BountyCancelled(uint256 indexed id);
    event BountyReclaimed(uint256 indexed id, address indexed creator, uint256 amount);
    event DisputeOpened(uint256 indexed id, address indexed hunter);
    event DisputeResolved(uint256 indexed id, address indexed winner, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    event FeeUpdated(uint256 feeBps, address indexed feeRecipient);
    event MinRewardUpdated(uint256 minReward);
    event DisputeWindowUpdated(uint64 disputeWindow);
    event ArbiterUpdated(address indexed arbiter);

    /* -------------------------------------------------------------------------- */
    /*                                   Errors                                   */
    /* -------------------------------------------------------------------------- */

    error RewardTooLow();
    error RewardTooLarge();
    error DeadlineInPast();
    error NotCreator();
    error NotArbiter();
    error WrongStatus();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error DisputeWindowClosed();
    error DisputeWindowOpen();
    error HasSubmissions();
    error NoSubmissions();
    error NotASubmitter();
    error SelfSubmission();
    error WinnerNotSubmitter();
    error FeeTooHigh();
    error ZeroAddress();
    error NothingToWithdraw();

    /* -------------------------------------------------------------------------- */
    /*                                 Constructor                                */
    /* -------------------------------------------------------------------------- */

    constructor(
        address owner_,
        address feeRecipient_,
        address arbiter_,
        uint256 feeBps_,
        uint256 minReward_,
        uint64 disputeWindow_
    ) Ownable(owner_) {
        if (feeRecipient_ == address(0) || arbiter_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        feeRecipient = feeRecipient_;
        arbiter = arbiter_;
        feeBps = feeBps_;
        minReward = minReward_;
        disputeWindow = disputeWindow_;
    }

    /* -------------------------------------------------------------------------- */
    /*                              Bounty lifecycle                              */
    /* -------------------------------------------------------------------------- */

    /// @notice Create a bounty, escrowing `msg.value` as the reward.
    function createBounty(uint64 deadline, bytes32 metadataHash)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value < minReward) revert RewardTooLow();
        if (msg.value > type(uint96).max) revert RewardTooLarge();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        id = nextBountyId++;
        bounties[id] = Bounty({
            creator: msg.sender,
            reward: uint96(msg.value),
            winner: address(0),
            deadline: deadline,
            status: Status.Open,
            feeBps: uint16(feeBps), // snapshot; MAX_FEE_BPS (1000) always fits
            submissionCount: 0,
            disputeWindow: disputeWindow, // snapshot
            metadataHash: metadataHash
        });

        emit BountyCreated(id, msg.sender, msg.value, deadline, metadataHash);
    }

    /// @notice Register a submission on-chain, anchoring the proof by hash.
    function submit(uint256 id, bytes32 proofHash) external {
        Bounty storage b = bounties[id];
        if (b.status != Status.Open) revert WrongStatus();
        if (block.timestamp > b.deadline) revert DeadlinePassed();
        if (msg.sender == b.creator) revert SelfSubmission();

        if (!hasSubmitted[id][msg.sender]) {
            hasSubmitted[id][msg.sender] = true;
            b.submissionCount += 1;
        }
        emit SubmissionCreated(id, msg.sender, proofHash);
    }

    /// @notice Creator approves a hunter's submission; pays out reward minus fee.
    function approve(uint256 id, address hunter) external nonReentrant {
        Bounty storage b = bounties[id];
        if (msg.sender != b.creator) revert NotCreator();
        if (b.status != Status.Open) revert WrongStatus();
        if (!hasSubmitted[id][hunter]) revert WinnerNotSubmitter();

        b.status = Status.Paid;
        b.winner = hunter;

        (uint256 payout, uint256 fee) = _split(b.reward, b.feeBps);
        emit BountyApproved(id, hunter, payout, fee);

        _pay(hunter, payout);
        if (fee > 0) _pay(feeRecipient, fee);
    }

    /// @notice Cancel and refund while the bounty has attracted no submissions.
    function cancel(uint256 id) external nonReentrant {
        Bounty storage b = bounties[id];
        if (msg.sender != b.creator) revert NotCreator();
        if (b.status != Status.Open) revert WrongStatus();
        if (b.submissionCount != 0) revert HasSubmissions();

        b.status = Status.Cancelled;
        uint256 amount = b.reward;
        emit BountyCancelled(id);
        _pay(b.creator, amount);
    }

    /// @notice Creator reclaims escrow after the deadline and dispute window elapse.
    function reclaim(uint256 id) external nonReentrant {
        Bounty storage b = bounties[id];
        if (msg.sender != b.creator) revert NotCreator();
        if (b.status != Status.Open) revert WrongStatus();
        if (block.timestamp <= uint256(b.deadline) + b.disputeWindow) revert DisputeWindowOpen();

        b.status = Status.Reclaimed;
        uint256 amount = b.reward;
        emit BountyReclaimed(id, b.creator, amount);
        _pay(b.creator, amount);
    }

    /// @notice A hunter contests within the dispute window to block a silent reclaim.
    function openDispute(uint256 id) external {
        Bounty storage b = bounties[id];
        if (b.status != Status.Open) revert WrongStatus();
        if (!hasSubmitted[id][msg.sender]) revert NotASubmitter();
        if (block.timestamp <= b.deadline) revert DeadlineNotPassed();
        if (block.timestamp > uint256(b.deadline) + b.disputeWindow) revert DisputeWindowClosed();

        b.status = Status.Disputed;
        emit DisputeOpened(id, msg.sender);
    }

    /// @notice Arbiter resolves a dispute: pay a hunter, or refund the creator (winner == 0).
    function resolveDispute(uint256 id, address winner) external nonReentrant {
        if (msg.sender != arbiter) revert NotArbiter();
        Bounty storage b = bounties[id];
        if (b.status != Status.Disputed) revert WrongStatus();

        if (winner == address(0)) {
            b.status = Status.Reclaimed;
            uint256 amount = b.reward;
            emit DisputeResolved(id, address(0), amount);
            _pay(b.creator, amount);
        } else {
            if (!hasSubmitted[id][winner]) revert WinnerNotSubmitter();
            b.status = Status.Paid;
            b.winner = winner;
            (uint256 payout, uint256 fee) = _split(b.reward, b.feeBps);
            emit DisputeResolved(id, winner, payout);
            _pay(winner, payout);
            if (fee > 0) _pay(feeRecipient, fee);
        }
    }

    /// @notice Withdraw funds credited by a failed push transfer (pull-payment fallback).
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "withdraw failed");
    }

    /* -------------------------------------------------------------------------- */
    /*                                Admin config                               */
    /* -------------------------------------------------------------------------- */

    /// @notice Update the fee rate (future bounties only — live escrows keep
    ///         their snapshotted rate) and the recipient (applies immediately,
    ///         so the platform wallet can rotate without touching escrows).
    function setFee(uint256 feeBps_, address feeRecipient_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeUpdated(feeBps_, feeRecipient_);
    }

    function setMinReward(uint256 minReward_) external onlyOwner {
        minReward = minReward_;
        emit MinRewardUpdated(minReward_);
    }

    /// @notice Update the dispute window for future bounties only — live
    ///         escrows keep the window they were created with.
    function setDisputeWindow(uint64 disputeWindow_) external onlyOwner {
        disputeWindow = disputeWindow_;
        emit DisputeWindowUpdated(disputeWindow_);
    }

    function setArbiter(address arbiter_) external onlyOwner {
        if (arbiter_ == address(0)) revert ZeroAddress();
        arbiter = arbiter_;
        emit ArbiterUpdated(arbiter_);
    }

    /* -------------------------------------------------------------------------- */
    /*                                Views/helpers                              */
    /* -------------------------------------------------------------------------- */

    function getBounty(uint256 id) external view returns (Bounty memory) {
        return bounties[id];
    }

    /// @dev Splits a reward into hunter payout and platform fee at the bounty's
    ///      snapshotted rate (never the current global rate).
    function _split(uint256 reward, uint256 feeBps_)
        internal
        pure
        returns (uint256 payout, uint256 fee)
    {
        fee = (reward * feeBps_) / BPS_DENOMINATOR;
        payout = reward - fee;
    }

    /// @dev Push ETH; on failure credit a withdrawable balance so state never wedges.
    function _pay(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) {
            pendingWithdrawals[to] += amount;
        }
    }
}
