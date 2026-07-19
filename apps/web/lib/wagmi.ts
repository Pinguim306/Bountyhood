import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { activeChain, robinhoodMainnet, robinhoodTestnet } from "./chains";

/**
 * Wallet setup:
 * - injected (MetaMask/Rabby/Brave extensions, and wallets' in-app browsers)
 * - WalletConnect, when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set — the
 *   standard path for regular MOBILE browsers, where no extension can inject
 *   a provider. Get a free project id at https://cloud.reown.com.
 * ConnectButton also offers wallet-app deep links as a zero-config fallback.
 */
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains: [activeChain, robinhoodTestnet, robinhoodMainnet],
  connectors: [
    injected(),
    ...(wcProjectId
      ? [
          walletConnect({
            projectId: wcProjectId,
            showQrModal: true,
            metadata: {
              name: "Bountyhood",
              description: "On-chain bounties on Robinhood Chain",
              url: "https://bountyhood.fun",
              icons: ["https://bountyhood.fun/icon.svg"],
            },
          }),
        ]
      : []),
  ],
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
