/**
 * Seeds Hardhat's compiler cache with the solc binary bundled in the npm `solc`
 * package, so `hardhat compile`/`test` work without reaching
 * binaries.soliditylang.org (blocked in some CI/sandbox networks).
 *
 * How it works: Hardhat prefers a *native* solc binary and only falls back to
 * the WASM (solcjs) build when the native one is flagged as non-working. We
 * therefore seed two things:
 *   1. the real WASM compiler (from the `solc` npm package), and
 *   2. a stub native entry marked ".does.not.work",
 * so Hardhat skips the (blocked) download and uses the seeded WASM compiler.
 *
 * Safe to run anywhere: if Hardhat can reach the network normally this simply
 * pre-populates the cache. Run it before `pnpm build` / `pnpm test`.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

// Keep in sync with the `solc` devDependency and hardhat.config.js.
const VERSION = "0.8.24";
const LONG_VERSION = "0.8.24+commit.e11b9ed9";
const BUILD = "commit.e11b9ed9";

// keccak256 is only checked by Hardhat when it *downloads* a compiler; on a warm
// cache hit (what this script produces) the check is skipped. We still store the
// real digest when a pure-JS hasher is resolvable, so a future re-verify passes.
function computeKeccak(bytes) {
  const candidates = [
    () => require("@noble/hashes/sha3").keccak_256(bytes),
    () => require("ethereum-cryptography/keccak").keccak256(bytes),
  ];
  for (const attempt of candidates) {
    try {
      return "0x" + Buffer.from(attempt()).toString("hex");
    } catch {
      /* try next */
    }
  }
  return "0x" + "00".repeat(32);
}

function getCompilersDir() {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "hardhat-nodejs", "compilers-v2");
}

// Matches CompilerDownloader.getCompilerPlatform() in Hardhat.
function nativePlatform() {
  switch (os.platform()) {
    case "win32":
      return { dir: "windows-amd64", file: `solc-windows-amd64-v${LONG_VERSION}.exe` };
    case "linux":
      return { dir: "linux-amd64", file: `solc-linux-amd64-v${LONG_VERSION}` };
    case "darwin":
      return { dir: "macosx-amd64", file: `solc-macosx-amd64-v${LONG_VERSION}` };
    default:
      return null; // host already uses WASM natively
  }
}

function writeList(dir, fileName, keccak) {
  const listPath = path.join(dir, "list.json");
  let list = { builds: [], releases: {}, latestRelease: VERSION };
  if (fs.existsSync(listPath)) {
    try {
      list = JSON.parse(fs.readFileSync(listPath, "utf8"));
    } catch {
      /* start fresh on a corrupt list */
    }
  }
  list.builds = (list.builds || []).filter((b) => b.longVersion !== LONG_VERSION);
  list.builds.push({
    path: fileName,
    version: VERSION,
    build: BUILD,
    longVersion: LONG_VERSION,
    keccak256: keccak,
    sha256: "",
    urls: [],
  });
  list.releases = list.releases || {};
  list.releases[VERSION] = fileName;
  list.latestRelease = list.latestRelease || VERSION;
  fs.writeFileSync(listPath, JSON.stringify(list, null, 2));
  return listPath;
}

function main() {
  const compilersDir = getCompilersDir();

  // 1. Seed the real WASM compiler from the npm `solc` package.
  const soljsonSrc = require.resolve("solc/soljson.js");
  const wasmDir = path.join(compilersDir, "wasm");
  fs.mkdirSync(wasmDir, { recursive: true });
  const wasmFile = `soljson-${LONG_VERSION}.js`;
  const bytes = fs.readFileSync(soljsonSrc);
  fs.writeFileSync(path.join(wasmDir, wasmFile), bytes);
  writeList(wasmDir, wasmFile, computeKeccak(bytes));
  console.log(`Seeded WASM solc ${LONG_VERSION} -> ${path.join(wasmDir, wasmFile)}`);

  // 2. Stub the native build and flag it non-working so Hardhat uses WASM.
  const native = nativePlatform();
  if (native) {
    const nativeDir = path.join(compilersDir, native.dir);
    fs.mkdirSync(nativeDir, { recursive: true });
    const binPath = path.join(nativeDir, native.file);
    fs.writeFileSync(binPath, "not-a-real-native-solc\n");
    fs.writeFileSync(`${binPath}.does.not.work`, "");
    writeList(nativeDir, native.file, "0x" + "00".repeat(32));
    console.log(`Stubbed native solc (${native.dir}) as non-working -> WASM fallback`);
  }
}

main();
