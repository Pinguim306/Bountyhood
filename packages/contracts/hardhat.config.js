require("@nomicfoundation/hardhat-toolbox");

const TESTNET_RPC =
  process.env.ROBINHOOD_TESTNET_RPC || "https://rpc.testnet.chain.robinhood.com/rpc";
const MAINNET_RPC =
  process.env.ROBINHOOD_MAINNET_RPC || "https://rpc.chain.robinhood.com/rpc";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = DEPLOYER_KEY ? [DEPLOYER_KEY] : [];

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    // Robinhood Chain testnet — Chain ID 46630
    robinhoodTestnet: {
      url: TESTNET_RPC,
      chainId: 46630,
      accounts,
    },
    // Robinhood Chain mainnet — Chain ID 4663 (ETH gas token)
    robinhoodMainnet: {
      url: MAINNET_RPC,
      chainId: 4663,
      accounts,
    },
  },
  // Blockscout verification (Robinhood Chain uses Blockscout explorers).
  etherscan: {
    apiKey: {
      robinhoodTestnet: "blockscout",
      robinhoodMainnet: "blockscout",
    },
    customChains: [
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
      {
        network: "robinhoodMainnet",
        chainId: 4663,
        urls: {
          apiURL: "https://explorer.chain.robinhood.com/api",
          browserURL: "https://explorer.chain.robinhood.com",
        },
      },
    ],
  },
};
