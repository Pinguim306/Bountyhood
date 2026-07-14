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
5. **Moderation** — anyone can report a bounty that breaks the
   [content policy](apps/web/app/terms/page.tsx); moderators (wallets in
   `NEXT_PUBLIC_ADMIN_ADDRESSES`) review reports and disputes at `/admin`.
   Hiding a bounty is UI-only — the escrow always follows the contract.

## Repository layout

```
packages/contracts   BountyEscrow smart contracts (Solidity + Hardhat)
apps/web             Web frontend (Next.js + wagmi/viem)
docs/                Planning docs
```

## Quickstart (web)

```bash
pnpm install
pnpm --filter @bountyhood/web dev   # http://localhost:3000
```

Runs in **preview mode** with sample data until a contract is deployed. Copy
`apps/web/.env.example` to `.env.local` and set
`NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS` to read live on-chain bounties.

## Status

- [x] **Phase 0** — monorepo, tooling, CI
- [x] **Phase 1** — `BountyEscrow` contract + full test suite (34 tests)
- [x] **Phase 2** — frontend core (bounty grid, creation, detail; wallet connect)
- [x] **Phase 3** — submissions, approval & payout flow (submit proof, approve,
      cancel, reclaim)
- [x] **Phase 4** — discovery & reputation (public profiles, hunter/creator
      leaderboards, activity feed)
- [x] **Phase 5** — moderation & disputes (report button, admin panel with
      report/dispute queues, hunter disputes, terms & content policy)
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

## Going live (preview → on-chain)

The app runs in **preview mode** (JSON-backed sample data) until the escrow
contract is deployed. To switch to real on-chain bounties:

1. Fund a deployer wallet with testnet ETH from the
   [faucet](https://faucet.testnet.chain.robinhood.com), set
   `DEPLOYER_PRIVATE_KEY`, and deploy:
   ```bash
   pnpm --filter @bountyhood/contracts deploy:testnet
   ```
2. Put the deployed address in `apps/web/.env.local`:
   ```
   NEXT_PUBLIC_CHAIN_ID=46630
   NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=0x…
   ```

The frontend's action layer (`lib/useBountyActions.ts`) already routes
`submit` / `approve` / `cancel` / `reclaim` to the contract when an address is
configured — no other code changes needed. Deployment must run from a network
that can reach the Robinhood RPC (some CI/sandbox egress policies block it).
