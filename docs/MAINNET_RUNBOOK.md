# Mainnet Launch Runbook — Robinhood Chain (4663)

Step-by-step to take Bountyhood from testnet to mainnet. Everything below is
already wired in the repo; the launch itself is configuration + two commands.

## 0. Prerequisites

- [x] Contract test suite green (`pnpm contracts:test` — 40 tests)
- [x] Security review complete ([`SECURITY_REVIEW.md`](SECURITY_REVIEW.md))
- [ ] Deployer wallet funded with mainnet ETH (bridge via the official
      Robinhood Chain bridge; gas for deploy is well under 0.01 ETH)
- [ ] **Platform wallet** (fee revenue) and **arbiter wallet** created — see §1

## 1. Wallet roles (do not skip)

Three distinct keys, three jobs:

| Role | Purpose | Recommendation |
| --- | --- | --- |
| `DEPLOYER` | Sends the deploy tx; becomes contract **owner** (config authority) | Hardware wallet or fresh key; keep it cold after launch |
| `FEE_RECIPIENT` | **Receives all platform revenue** — the fee on every payout | Your treasury wallet. Can be rotated later with `setFee(sameBps, newWallet)` without touching escrows |
| `ARBITER` | Rules on disputes (pay hunter / refund creator) | Separate hot key used by whoever operates the `/admin` dispute queue |

Revenue model (as designed): the platform takes **`FEE_BPS` of each successful
payout** — creator approvals and arbiter-awarded disputes. Refunds
(cancel/reclaim) are never taxed, and there is no creation fee, so posting a
bounty stays frictionless and revenue aligns with completed work. Each bounty
locks its fee rate at creation (the rate is a term of the deal), so raising
`FEE_BPS` later only affects new bounties.

The mainnet deploy script **hard-fails** unless `FEE_RECIPIENT` and `ARBITER`
are set explicitly — fees can't silently default to the deployer.

## 2. Deploy parameters

Recommended launch values (all env-overridable):

| Env | Value | Meaning |
| --- | --- | --- |
| `FEE_RECIPIENT` | *your treasury wallet* | revenue destination (required) |
| `ARBITER` | *ops wallet* | dispute authority (required) |
| `FEE_BPS` | `250` (2.5%) | payout fee; contract hard-caps at 1000 (10%) |
| `MIN_REWARD_ETH` | `0.001` | anti-dust floor (~$5 at launch prices, per the GO model) |
| `DISPUTE_WINDOW_SEC` | `259200` (72h) | matches the frontend's `DISPUTE_WINDOW_SECS` |

## 3. Deploy & verify

```bash
cd packages/contracts
export DEPLOYER_PRIVATE_KEY=0x…
export FEE_RECIPIENT=0x…   # platform treasury
export ARBITER=0x…         # dispute ops wallet

pnpm deploy:mainnet
# prints the address + the exact `hardhat verify` command to run next
npx hardhat verify --network robinhoodMainnet <address> <constructor args…>
```

Sanity-check on Blockscout (`https://robinhoodchain.blockscout.com`):
`owner()`, `feeRecipient()`, `arbiter()`, `feeBps()`, `minReward()`,
`disputeWindow()` all match §2.

## 4. Point the frontend at mainnet

`apps/web/.env.local` (or the hosting provider's env settings):

```
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=0x…       # from §3
NEXT_PUBLIC_ADMIN_ADDRESSES=0x…             # must include the ARBITER wallet
```

Redeploy the web app. The action layer (`lib/useBountyActions.ts`) switches
from preview mode to on-chain writes automatically once the address is set.

## 5. Start monitoring

```bash
cd packages/contracts
BOUNTY_ESCROW_ADDRESS=0x… \
RPC_URL=https://rpc.mainnet.chain.robinhood.com \
ALERT_WEBHOOK_URL=https://hooks.slack.com/…   # optional \
pnpm monitor
```

Run it under a process supervisor (systemd/pm2/a small VM). It alerts on:

- any admin config change (fee, recipient, arbiter, window, min reward)
- every `DisputeOpened` (arbiter action needed within operator SLA)
- bounties ≥ `ALERT_REWARD_ETH` (default 5 ETH)
- `Withdrawn` events (means a push payment failed earlier — investigate why)

## 6. Launch smoke test (real funds, small)

1. Create a bounty with `MIN_REWARD_ETH` from a personal wallet.
2. Submit to it from a second wallet; approve; confirm the hunter received
   `reward × (1 − FEE_BPS/10000)` and **the treasury received the fee**.
3. Create + cancel a second bounty; confirm full refund (no fee).
4. Confirm both flows appear in the app's activity feed and in the monitor log.

## 7. Post-launch

- Keep `DEPLOYER` cold; owner actions (fee changes, arbiter rotation) should be
  rare and each one fires a monitor alert.
- Review the dispute queue at `/admin` at least daily while volume is low.
- Revisit `FEE_BPS` with real volume data; changes only affect new bounties.
- Schedule an external audit before high-value bounties become routine
  (review recommendation: ~10 ETH per bounty).
