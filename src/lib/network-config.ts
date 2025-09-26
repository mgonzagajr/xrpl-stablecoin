/**
 * XRPL network configuration
 * Centralizes URLs and specific settings for each network
 */

export type XRPLNetwork = 'TESTNET' | 'MAINNET';

export interface NetworkConfig {
  wsUrl: string;
  name: string;
  description: string;
  hasFaucet: boolean;
  minReserve: number; // Minimum XRP for account reserve
  recommendedMin: number; // Recommended XRP for operations
}

export const NETWORK_CONFIGS: Record<XRPLNetwork, NetworkConfig> = {
  TESTNET: {
    wsUrl: 'wss://s.altnet.rippletest.net:51233',
    name: 'Testnet',
    description: 'Rede de testes do XRPL',
    hasFaucet: true,
    minReserve: 10,
    recommendedMin: 20
  },
  MAINNET: {
    wsUrl: 'wss://xrplcluster.com',
    name: 'Mainnet',
    description: 'Rede principal do XRPL',
    hasFaucet: false,
    minReserve: 10,
    recommendedMin: 20
  }
};

/**
 * Gets the HTTP API URL for the current XRPL network
 */
export function getXrplApiUrl(): string {
  const network = (process.env.XRPL_NETWORK || 'TESTNET') as XRPLNetwork;
  if (network === 'MAINNET') {
    return 'https://xrplcluster.com';
  } else {
    return 'https://testnet.xrpl-labs.com';
  }
}

/**
 * Gets the network configuration based on the environment variable
 */
export function getNetworkConfig(): NetworkConfig {
  const network = (process.env.XRPL_NETWORK || 'TESTNET') as XRPLNetwork;
  return NETWORK_CONFIGS[network];
}

/**
 * Gets the WebSocket URL for the current network
 */
export function getWebSocketUrl(): string {
  return getNetworkConfig().wsUrl;
}

/**
 * Checks if the current network has a faucet available
 */
export function hasFaucet(): boolean {
  return getNetworkConfig().hasFaucet;
}

/**
 * Gets the recommended minimum XRP for the current network
 */
export function getRecommendedMinXrp(): number {
  return getNetworkConfig().recommendedMin;
}

/**
 * Gets current network info for display
 */
export function getNetworkInfo() {
  const config = getNetworkConfig();
  const network = process.env.XRPL_NETWORK || 'TESTNET';
  
  return {
    network,
    name: config.name,
    description: config.description,
    hasFaucet: config.hasFaucet,
    minReserve: config.minReserve,
    recommendedMin: config.recommendedMin
  };
}
