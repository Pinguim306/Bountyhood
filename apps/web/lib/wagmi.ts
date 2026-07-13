import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { activeChain, robinhoodMainnet, robinhoodTestnet } from "./chains";

/**
 * MVP wallet setup: the injected connector (MetaMask/Rabby/Brave) — no external
 * WalletConnect project id required. RainbowKit / WalletConnect can be layered
 * in later without changing consumers.
 */
export const wagmiConfig = createConfig({
  chains: [activeChain, robinhoodTestnet, robinhoodMainnet],
  connectors: [injected()],
  transports: {
    [robinhoodTestnet.id]: http(),
    [robinhoodMainnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
