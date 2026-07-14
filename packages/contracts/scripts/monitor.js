const { ethers } = require("ethers");
const artifact = require("../artifacts/contracts/BountyEscrow.sol/BountyEscrow.json");

/**
 * BountyEscrow event monitor (Phase 6). Polls the chain for contract events,
 * logs the activity stream, and raises ALERTs on anything that warrants a
 * human look:
 *
 *   - any admin config change (fee, recipient, arbiter, window, min reward)
 *   - disputes opened (arbiter action needed)
 *   - unusually large bounties (>= ALERT_REWARD_ETH, default 5)
 *   - Withdrawn events (means an earlier push payment failed)
 *
 * Usage:
 *   BOUNTY_ESCROW_ADDRESS=0x… RPC_URL=https://rpc.chain.robinhood.com/rpc \
 *     node scripts/monitor.js
 *
 * Optional env:
 *   POLL_INTERVAL_SEC  polling cadence (default 15)
 *   START_BLOCK        first block to scan (default: latest at startup)
 *   ALERT_REWARD_ETH   large-bounty threshold (default 5)
 *   ALERT_WEBHOOK_URL  POST alerts as JSON (Slack/Discord-style webhook)
 */

const ADDRESS = process.env.BOUNTY_ESCROW_ADDRESS;
const RPC_URL = process.env.RPC_URL || "https://rpc.chain.robinhood.com/rpc";
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_SEC || 15) * 1000;
const ALERT_REWARD = ethers.parseEther(process.env.ALERT_REWARD_ETH || "5");
const WEBHOOK = process.env.ALERT_WEBHOOK_URL;

if (!ADDRESS) {
  console.error("Set BOUNTY_ESCROW_ADDRESS to the deployed contract address.");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const iface = new ethers.Interface(artifact.abi);

const ADMIN_EVENTS = new Set([
  "FeeUpdated",
  "MinRewardUpdated",
  "DisputeWindowUpdated",
  "ArbiterUpdated",
]);

function fmtEth(wei) {
  return `${ethers.formatEther(wei)} ETH`;
}

async function alert(kind, message, log) {
  const line = `ALERT [${kind}] ${message} (block ${log.blockNumber}, tx ${log.transactionHash})`;
  console.error(line);
  if (!WEBHOOK) return;
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: line, kind, tx: log.transactionHash }),
    });
  } catch (err) {
    console.error(`  (webhook delivery failed: ${err.message})`);
  }
}

async function handle(log) {
  let parsed;
  try {
    parsed = iface.parseLog({ topics: log.topics, data: log.data });
  } catch {
    return; // not one of ours
  }
  const { name, args } = parsed;
  console.log(`[${new Date().toISOString()}] ${name}`, args.toString());

  if (ADMIN_EVENTS.has(name)) {
    await alert("admin-config", `${name}: ${args.toString()}`, log);
  } else if (name === "DisputeOpened") {
    await alert(
      "dispute",
      `bounty #${args.id} disputed by ${args.hunter} — arbiter action needed`,
      log
    );
  } else if (name === "BountyCreated" && args.reward >= ALERT_REWARD) {
    await alert(
      "large-bounty",
      `bounty #${args.id} created with ${fmtEth(args.reward)} by ${args.creator}`,
      log
    );
  } else if (name === "Withdrawn") {
    await alert(
      "pull-payment",
      `${args.account} withdrew ${fmtEth(args.amount)} — an earlier push payment failed`,
      log
    );
  }
}

async function main() {
  const net = await provider.getNetwork();
  let from = process.env.START_BLOCK
    ? Number(process.env.START_BLOCK)
    : await provider.getBlockNumber();
  console.log(
    `Monitoring BountyEscrow ${ADDRESS} on chain ${net.chainId} from block ${from} ` +
      `(poll ${POLL_INTERVAL / 1000}s, large-bounty threshold ${fmtEth(ALERT_REWARD)})`
  );

  // Poll rather than subscribe: works over plain HTTPS RPC and survives
  // transient provider hiccups.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const latest = await provider.getBlockNumber();
      if (latest >= from) {
        const logs = await provider.getLogs({
          address: ADDRESS,
          fromBlock: from,
          toBlock: latest,
        });
        for (const log of logs) await handle(log);
        from = latest + 1;
      }
    } catch (err) {
      console.error(`poll error (will retry): ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
