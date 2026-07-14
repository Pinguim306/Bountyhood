const fs = require("fs");
const path = require("path");

/**
 * Exports the compiled BountyEscrow ABI to the web app so the frontend never
 * drifts from the contract. Run after any contract change:
 *   pnpm --filter @bountyhood/contracts build && node scripts/export-abi.js
 */
const artifact = require(path.join(
  __dirname,
  "../artifacts/contracts/BountyEscrow.sol/BountyEscrow.json"
));
const out = path.join(__dirname, "../../../apps/web/lib/abi/BountyEscrow.ts");

const banner =
  "// Auto-generated from packages/contracts artifacts — do not edit by hand.\n" +
  "// Regenerate with: pnpm --filter @bountyhood/contracts export-abi\n";
fs.writeFileSync(
  out,
  `${banner}export const bountyEscrowAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`
);
console.log(`ABI exported to ${path.relative(process.cwd(), out)}`);
