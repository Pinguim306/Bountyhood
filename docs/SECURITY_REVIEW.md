# BountyEscrow — Security Review (Phase 6)

Self-audit + static analysis performed ahead of the Robinhood Chain mainnet
(4663) deployment. Reviewed at the commit that introduces this document;
`BountyEscrow.sol`, Solidity 0.8.24, OpenZeppelin v5 (`Ownable`,
`ReentrancyGuard`).

## Scope & method

1. Manual line-by-line review of `BountyEscrow.sol` (lifecycle, fund flows,
   access control, state machine).
2. [Slither](https://github.com/crytic/slither) 0.11.5, all default detectors,
   dependencies excluded.
3. Full Hardhat suite: **40 tests** (unit, lifecycle, disputes, pull-payment,
   term-snapshot regression tests added by this review).

## Findings — fixed in this review

### M-1: Fee rate applied retroactively to live escrows (fixed)

`feeBps` was read at payout time, so the owner could raise the fee (up to the
10% `MAX_FEE_BPS`) *after* creators had already locked funds, and the higher
rate would apply to existing bounties.

**Fix:** each bounty snapshots `feeBps` at creation (`Bounty.feeBps`, packed —
no extra storage slot) and pays out at that rate forever. `setFee` now only
affects future bounties. The fee **recipient** intentionally remains a live
global so the platform wallet can rotate without touching escrows (rate is a
term of the deal; the collection address is operational).

### M-2: Dispute window applied retroactively (fixed)

`disputeWindow` was also read live. Shrinking it could instantly unlock
`reclaim` on expired bounties, silently destroying hunters' dispute rights;
growing it could lock creators out of refunds.

**Fix:** snapshotted per bounty at creation (`Bounty.disputeWindow`);
`reclaim`/`openDispute` use the stored value. Regression tests cover both
directions.

### L-1: Silent `uint96` truncation of the reward (fixed)

`createBounty` cast `msg.value` to `uint96` unchecked. Unreachable with ETH's
real supply (`uint96` max ≈ 7.9e10 ETH), but the guard is one line:
`msg.value > type(uint96).max` now reverts `RewardTooLarge`. Covered by a test
using a high-balance dev account.

### I-1: Admin events had no indexed address parameters (fixed)

`FeeUpdated`/`ArbiterUpdated` addresses are now `indexed`, making the
monitoring script's admin-change alerts filterable.

## Slither results — remaining detectors, triaged

| Detector | Verdict |
| --- | --- |
| `arbitrary-send-eth` (`_pay`) | False positive. Recipients are never arbitrary: creator (cancel/reclaim/refund), a validated submitter (approve/resolve), or `feeRecipient`. |
| `reentrancy-eth` (`approve`, `resolveDispute`) | Mitigated by design. Status flips **before** any external call (CEI) and every fund-moving function shares one `nonReentrant` mutex — including `withdraw`, so the flagged cross-function path through `pendingWithdrawals` is closed. |
| `reentrancy-benign` (`_pay`) | The post-call write is the pull-payment credit itself; benign by construction. |
| `low-level-calls` | Intentional: `.call{value:}` is the correct primitive for push payments with a failure fallback. |
| `timestamp` | Deadlines/windows are the domain model. Sequencer drift is seconds against 72-hour windows. |
| `pragma` | OZ ships `^0.8.20`, project pins 0.8.24; single compiler compiles all. |
| `locked-ether` (`RejectEther`) | Test-only mock that exists precisely to reject ETH. |

## Design properties confirmed by review

- **No owner rug surface.** There is no arbitrary-withdraw function; the owner
  can only tune terms for *future* bounties (post-fix) and rotate roles. Escrow
  can only flow to creator, a validated submitter, or the fee recipient.
- **Checks-effects-interactions** throughout; state transitions precede
  transfers.
- **Pull-payment fallback.** A reverting recipient can never wedge a bounty:
  `_pay` credits `pendingWithdrawals` on failure; `withdraw` zeroes before
  sending and reverts on failure (no loss path).
- **Separation of duties.** `owner` (config) ≠ `arbiter` (dispute rulings);
  mainnet deploy script refuses to default either revenue or arbitration to the
  deployer key.
- **ETH only enters via `createBounty`** — no `receive`/`fallback`, so contract
  balance always equals live escrows + pending withdrawals.

## Accepted risks (documented, not fixed)

1. **Trusted arbiter.** Disputes are settled by a single platform key — the
   MVP's explicit trust model (plan §6.2). Mitigations: arbiter can only pick a
   validated submitter or refund the creator; a stake/jury design is a future
   phase.
2. **Dispute griefing.** Any submitter can freeze an expired bounty until the
   arbiter acts. Cost to attack is one submission + gas; the arbiter's refund
   path resolves it. Monitor alerts on every `DisputeOpened`.
3. **Off-chain content trust.** Metadata/proofs are anchored by hash only;
   correctness of the content itself is a moderation problem (Phase 5), not a
   contract one.

## Recommendation

Ship to mainnet with the runbook's parameters
([`MAINNET_RUNBOOK.md`](MAINNET_RUNBOOK.md)), keep the event monitor running,
and commission an external review before rewards regularly exceed ~10 ETH per
bounty.
