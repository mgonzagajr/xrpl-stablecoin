/**
 * Configurações de rede XRPL
 * Centraliza as URLs e configurações específicas de cada rede
 */

export type XRPLNetwork = 'TESTNET' | 'MAINNET';

export interface NetworkConfig {
  wsUrl: string;
  name: string;
  description: string;
  hasFaucet: boolean;
  minReserve: number; // XRP mínimo para reserva de conta
  recommendedMin: number; // XRP recomendado para operações
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
 * Obtém a configuração da rede baseada na variável de ambiente
 */
export function getNetworkConfig(): NetworkConfig {
  const network = (process.env.XRPL_NETWORK || 'TESTNET') as XRPLNetwork;
  return NETWORK_CONFIGS[network];
}

/**
 * Obtém a URL WebSocket da rede atual
 */
export function getWebSocketUrl(): string {
  return getNetworkConfig().wsUrl;
}

/**
 * Verifica se a rede atual tem faucet disponível
 */
export function hasFaucet(): boolean {
  return getNetworkConfig().hasFaucet;
}

/**
 * Obtém o XRP mínimo recomendado para a rede atual
 */
export function getRecommendedMinXrp(): number {
  return getNetworkConfig().recommendedMin;
}

/**
 * Obtém informações da rede atual para exibição
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
