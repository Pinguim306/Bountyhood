const { ethers, network } = require("hardhat");

/**
 * Deploys BountyEscrow. Config is taken from env vars with sensible defaults:
 *   FEE_RECIPIENT      - address that collects platform fees (default: deployer)
 *   ARBITER            - address that resolves disputes      (default: deployer)
 *   FEE_BPS            - platform fee in basis points, <= 1000 (default: 250 = 2.5%)
 *   MIN_REWARD_ETH     - minimum reward at creation           (default: 0.001)
 *   DISPUTE_WINDOW_SEC - seconds after deadline to dispute    (default: 259200 = 3d)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = deployer.address;

  // Mainnet refuses to fall back to the deployer for revenue/authority roles:
  // fees must knowingly go to the platform wallet, and the arbiter should be a
  // separate key from the (typically hot) deployer.
  const isMainnet = network.config.chainId === 4663;
  if (isMainnet && (!process.env.FEE_RECIPIENT || !process.env.ARBITER)) {
    throw new Error(
      "Mainnet deploy requires explicit FEE_RECIPIENT and ARBITER env vars " +
        "(fees default to the deployer otherwise — almost never what you want)."
    );
  }
  const feeRecipient = process.env.FEE_RECIPIENT || owner;
  const arbiter = process.env.ARBITER || owner;
  const feeBps = BigInt(process.env.FEE_BPS || "250");
  const minReward = ethers.parseEther(process.env.MIN_REWARD_ETH || "0.001");
  const disputeWindow = BigInt(process.env.DISPUTE_WINDOW_SEC || String(3 * 24 * 60 * 60));

  console.log(`Network:       ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer:      ${owner}`);
  console.log(`Fee recipient: ${feeRecipient}`);
  console.log(`Arbiter:       ${arbiter}`);
  console.log(`Fee:           ${feeBps} bps`);
  console.log(`Min reward:    ${ethers.formatEther(minReward)} ETH`);
  console.log(`Dispute window:${disputeWindow} s`);

  const Factory = await ethers.getContractFactory("BountyEscrow");
  const escrow = await Factory.deploy(
    owner,
    feeRecipient,
    arbiter,
    feeBps,
    minReward,
    disputeWindow
  );
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log(`\nBountyEscrow deployed to: ${address}`);
  console.log(
    `Verify with:\n  npx hardhat verify --network ${network.name} ${address} \\` +
      `\n    ${owner} ${feeRecipient} ${arbiter} ${feeBps} ${minReward} ${disputeWindow}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
