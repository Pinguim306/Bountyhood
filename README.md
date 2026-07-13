# Bountyhood

An on-chain **bounty platform on [Robinhood Chain](https://robinhood.com/us/en/chain/)**.
Users create bounties with a reward escrowed on-chain; other users complete the
task, submit proof, and get paid. Inspired by [pump.fun GO](https://pump.fun/go),
but focused solely on bounties — no trading, no launchpad.

## How it works

1. **Create** — a creator posts a bounty (title, description, deliverables,
   deadline) and escrows the reward in ETH. Funds lock at creation.
2. **Hunt** — anyone completes the task and submits proof; each submission is
   anchored on-chain by hash.
3. **Approve** — the creator approves a submission and the escrow pays the
   hunter automatically, minus a small platform fee.
4. **Expire / dispute** — if no submission is approved, the creator reclaims the
   escrow after the deadline and a dispute window. A hunter can open a dispute in
   that window, which an arbiter resolves.

## Repository layout

```
packages/contracts   BountyEscrow smart contracts (Solidity + Hardhat)
apps/web             Web frontend (Next.js) — coming next
docs/                Planning docs
```

## Status

- [x] **Phase 0** — monorepo, tooling, CI
- [x] **Phase 1** — `BountyEscrow` contract + full test suite (34 tests)
- [ ] **Phase 2** — frontend core (bounty grid + creation)
- [ ] **Phase 3** — submissions & payout UI
- [ ] **Phase 4** — discovery, profiles, leaderboard
- [ ] **Phase 5** — moderation & disputes
- [ ] **Phase 6** — mainnet

See [`docs/PLANO_DE_DESENVOLVIMENTO.md`](docs/PLANO_DE_DESENVOLVIMENTO.md) for the
full plan (in Portuguese).

## Quickstart (contracts)

```bash
pnpm install
pnpm --filter @bountyhood/contracts seed-solc   # offline-friendly solc setup
pnpm contracts:build
pnpm contracts:test
```

## Robinhood Chain

| Network | Chain ID | Gas token | Explorer |
| --- | --- | --- | --- |
| Testnet | 46630 | ETH | Blockscout |
| Mainnet | 4663 | ETH | Blockscout |

Robinhood Chain is an Arbitrum Orbit L2, 100% EVM-compatible, so the standard
Solidity/Hardhat/viem/wagmi toolchain works without modification.
