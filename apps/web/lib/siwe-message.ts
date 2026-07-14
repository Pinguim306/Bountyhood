/**
 * Sign-in message shared by client (builds + signs) and server (rebuilds +
 * verifies). Keeping one builder guarantees both sides hash the same bytes.
 * Isomorphic — no Node APIs here.
 */
export function buildSignInMessage(input: {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string; // ISO timestamp
}): string {
  return [
    `${input.domain} wants you to sign in with your wallet:`,
    input.address,
    "",
    "This signature proves you own this wallet. It is free and sends no transaction.",
    "",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
  ].join("\n");
}
