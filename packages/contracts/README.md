# @bountyhood/contracts

Smart contracts for **Bountyhood** — an on-chain bounty platform on Robinhood Chain.

## BountyEscrow

Holds bounty rewards (native ETH) in escrow and enforces the payout rules. Money
is the on-chain source of truth; rich content (descriptions, proof media) lives
off-chain and is anchored here by `keccak256` hashes.

### Lifecycle

| From | Action | To | Who |
| --- | --- | --- | --- |
| — | `createBounty(deadline, metadataHash)` `+ETH` | `Open` | anyone |
| `Open` | `submit(id, proofHash)` | `Open` | hunters (not the creator) |
| `Open` | `approve(id, hunter)` | `Paid` | creator |
| `Open` | `cancel(id)` (no submissions yet) | `Cancelled` | creator |
| `Open` | `reclaim(id)` (after deadline + dispute window) | `Reclaimed` | creator |
| `Open` | `openDispute(id)` (in window, after deadline) | `Disputed` | a submitter |
| `Disputed` | `resolveDispute(id, winner)` | `Paid` / `Reclaimed` | arbiter |

Payouts deduct a platform fee (`feeBps`, hard-capped at 10%). ETH transfers use a
pull-payment fallback: if a push fails, the amount is credited to
`pendingWithdrawals` and claimable via `withdraw()`, so no state ever wedges.

### Security properties

- `ReentrancyGuard` on every fund-moving function; checks-effects-interactions.
- No owner backdoor: the owner can tune fee/arbiter/limits but cannot move escrow.
- Fee capped at `MAX_FEE_BPS = 1000` (10%) at construction and on `setFee`.
- Separation of duties: `owner` (config) vs `arbiter` (dispute resolution).

## Networks

| Network | Chain ID | RPC (default) |
| --- | --- | --- |
| Robinhood testnet | 46630 | `https://rpc.testnet.chain.robinhood.com/rpc` |
| Robinhood mainnet | 4663 | `https://rpc.chain.robinhood.com/rpc` |

Gas is paid in ETH. Override RPCs and the deployer key via env vars (see
`.env.example`).

## Usage

```bash
pnpm install
pnpm seed-solc     # populate Hardhat's solc cache from the npm `solc` package
pnpm build         # hardhat compile
pnpm test          # hardhat test (34 tests)

# Deploy (needs DEPLOYER_PRIVATE_KEY in the environment)
pnpm deploy:testnet
pnpm deploy:mainnet
```

### Why `seed-solc`?

Hardhat downloads the Solidity compiler from `binaries.soliditylang.org`. In
networks where that host is blocked (some CI/sandbox egress policies), run
`pnpm seed-solc` first: it seeds Hardhat's compiler cache from the `solc` npm
package (which bundles the compiler), so `build`/`test` work fully offline. In a
normal network it's a harmless no-op. In CI, run it before `build`/`test`.
