import { defineChain } from "viem";

/**
 * Robinhood Chain — Arbitrum Orbit L2, ETH gas token.
 * Testnet: 46630 · Mainnet: 4663 (both use Blockscout explorers).
 */
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com/rpc"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

export const robinhoodMainnet = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export const CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? robinhoodTestnet.id
);

export const activeChain =
  CHAIN_ID === robinhoodMainnet.id ? robinhoodMainnet : robinhoodTestnet;
