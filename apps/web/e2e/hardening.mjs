// E2E regression test for API authentication hardening (preview mode, real
// signatures). Run against a local server:
//   DATABASE_URL=… AUTH_SECRET=test NEXT_PUBLIC_ADMIN_ADDRESSES=0xf39F…2266 \
//     npx next start -p 3129 &  node e2e/hardening.mjs
import { privateKeyToAccount } from "viem/accounts";

const BASE = "http://localhost:3129";
const DOMAIN = "localhost:3129";
const CREATOR_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const HUNTER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name} ${extra}`);
}

function msg({ address, nonce, issuedAt }) {
  return [
    `${DOMAIN} wants you to sign in with your wallet:`,
    address,
    "",
    "This signature proves you own this wallet. It is free and sends no transaction.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

async function signIn(key) {
  const acct = privateKeyToAccount(key);
  const { nonce } = await (await fetch(`${BASE}/api/auth/nonce`)).json();
  const issuedAt = new Date().toISOString();
  const signature = await acct.signMessage({
    message: msg({ address: acct.address, nonce, issuedAt }),
  });
  const res = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: acct.address, nonce, issuedAt, signature }),
  });
  return { cookie: res.headers.get("set-cookie").split(";")[0], acct };
}

const creator = await signIn(CREATOR_KEY);
const hunter = await signIn(HUNTER_KEY);
const json = { "content-type": "application/json" };

// 1. create WITHOUT session -> 401 (the zero-address bug)
let r = await fetch(`${BASE}/api/bounties`, {
  method: "POST",
  headers: json,
  body: JSON.stringify({
    title: "spoof",
    description: "x",
    rewardEth: "99",
    deadline: Math.floor(Date.now() / 1000) + 3600,
  }),
});
check("create without session rejected (401)", r.status === 401);

// 2. create WITH session -> creator = session address, ignores body creator
r = await fetch(`${BASE}/api/bounties`, {
  method: "POST",
  headers: { ...json, cookie: creator.cookie },
  body: JSON.stringify({
    title: "Hardening test bounty",
    description: "escrow rules",
    category: "Development",
    rewardEth: "0.2",
    deadline: Math.floor(Date.now() / 1000) + 3600,
    creator: "0x0000000000000000000000000000000000000000", // must be ignored
  }),
});
const bounty = await r.json();
check(
  "create uses session identity (not body)",
  r.status === 201 &&
    bounty.creator === creator.acct.address.toLowerCase()
);

// 3. submit without session -> 401
r = await fetch(`${BASE}/api/bounties/${bounty.id}/submissions`, {
  method: "POST",
  headers: json,
  body: JSON.stringify({ hunter: "0x1234", summary: "spoofed" }),
});
check("submit without session rejected (401)", r.status === 401);

// 4. submit with hunter session -> hunter = session
r = await fetch(`${BASE}/api/bounties/${bounty.id}/submissions`, {
  method: "POST",
  headers: { ...json, cookie: hunter.cookie },
  body: JSON.stringify({
    hunter: "0x9999999999999999999999999999999999999999", // ignored
    summary: "real work",
    links: "https://example.com",
  }),
});
const sub = await r.json();
check(
  "submit uses session identity (not body)",
  r.status === 201 && sub.hunter === hunter.acct.address.toLowerCase()
);

// 5. approve with the HUNTER's session (not creator) -> rejected
r = await fetch(`${BASE}/api/bounties/${bounty.id}/actions`, {
  method: "POST",
  headers: { ...json, cookie: hunter.cookie },
  body: JSON.stringify({ action: "approve", submissionId: sub.id }),
});
check("non-creator cannot approve", r.status === 400);

// 6. approve with creator session -> Paid
r = await fetch(`${BASE}/api/bounties/${bounty.id}/actions`, {
  method: "POST",
  headers: { ...json, cookie: creator.cookie },
  body: JSON.stringify({ action: "approve", submissionId: sub.id }),
});
const paid = await r.json();
check("creator approves -> Paid", r.status === 200 && paid.status === 1);

// 7. admin GET without session -> 403; with non-admin session -> 403
r = await fetch(`${BASE}/api/admin`);
const noSess = r.status;
r = await fetch(`${BASE}/api/admin`, { headers: { cookie: hunter.cookie } });
check(
  "admin API rejects anonymous + non-admin sessions",
  noSess === 403 && r.status === 403
);

// 8. admin POST spoofing a moderator address in body -> still 403
r = await fetch(`${BASE}/api/admin`, {
  method: "POST",
  headers: { ...json, cookie: hunter.cookie },
  body: JSON.stringify({
    caller: process.env.ADMIN_ADDR, // spoof attempt, must be ignored
    action: "hide",
    bountyId: bounty.id,
  }),
});
check("moderation spoof via body rejected", r.status === 403);

// 9. admin with the REAL admin session (creator is allowlisted in this test)
r = await fetch(`${BASE}/api/admin`, { headers: { cookie: creator.cookie } });
check("signed-in moderator can access admin", r.status === 200);

// 10. report requires session; reporter = session
r = await fetch(`${BASE}/api/bounties/${bounty.id}/report`, {
  method: "POST",
  headers: json,
  body: JSON.stringify({ reason: "Other", details: "x" }),
});
check("report without session rejected (401)", r.status === 401);

const failed = results.filter((x) => !x.ok).length;
console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
