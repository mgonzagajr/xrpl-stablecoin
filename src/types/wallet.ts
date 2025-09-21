export type WalletRole = 'issuer' | 'hot' | 'seller' | 'buyer';

export interface Wallet {
  role: WalletRole;
  address: string;
  publicKey: string;
  privateKey: string;
  seed: string;
}

export interface WalletData {
  version: number;
  createdAt: string;
  network: 'TESTNET' | 'MAINNET';
  sourceTag: number;
  wallets: Wallet[];
  configuration?: {
    issuerFlags?: {
      configured: boolean;
      configuredAt?: string;
      flags: {
        defaultRipple: boolean;
        requireAuth: boolean;
        noFreeze: boolean;
      };
    };
    trustLines?: {
      configured: boolean;
      configuredAt?: string;
      currency: string;
      limit: string;
      results: Array<{
        role: WalletRole;
        address: string;
        created: boolean;
        txHash?: string;
      }>;
    };
  };
}

export interface WalletResponse {
  role: WalletRole;
  address: string;
  balanceXrp?: number;
  balanceDrops?: string;
  balanceSbr?: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  created?: boolean;
}

export interface WalletsApiData {
  network: 'TESTNET' | 'MAINNET';
  sourceTag: number;
  wallets: WalletResponse[];
}

export interface WalletBalance {
  role: string;
  address: string;
  balanceXrp: number;
  balanceDrops: string;
  balanceSbr?: string;
}

export interface BalancesApiData {
  network: 'TESTNET' | 'MAINNET';
  sourceTag: number;
  balances: WalletBalance[];
}
