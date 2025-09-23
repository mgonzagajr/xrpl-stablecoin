import { useState, useEffect, useCallback } from 'react';
import { WalletsApiData, BalancesApiData, ApiResponse } from '@/types/wallet';

const CACHE_KEY = 'xrpl_wallets_cached_v1';

interface UseWalletsReturn {
  wallets: WalletsApiData | null;
  balances: BalancesApiData | null;
  configuration: {
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
        role: string;
        address: string;
        created: boolean;
        txHash?: string;
      }>;
    };
  } | null;
  loading: boolean;
  error: string | null;
  initializeWallets: () => Promise<void>;
  refreshWallets: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  fundWallet: (role: string) => Promise<{ success: boolean; error?: string }>;
  clearCache: () => void;
}

export function useWallets(): UseWalletsReturn {
  const [wallets, setWallets] = useState<WalletsApiData | null>(null);
  const [balances, setBalances] = useState<BalancesApiData | null>(null);
  const [configuration, setConfiguration] = useState<UseWalletsReturn['configuration']>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFromCache = useCallback((): WalletsApiData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Invalid cache, ignore
    }
    return null;
  }, []);

  const saveToCache = useCallback((data: WalletsApiData) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // Cache save failed, ignore
    }
  }, []);

  const fetchWallets = useCallback(async (): Promise<WalletsApiData | null> => {
    try {
      const response = await fetch('/api/wallets/read');
      const result: ApiResponse<WalletsApiData> = await response.json();
      
      if (result.ok && result.data) {
        return result.data;
      } else if (result.error === 'NOT_INITIALIZED') {
        return null;
      } else {
        throw new Error(result.error || 'Failed to fetch wallets');
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch wallets');
    }
  }, []);

  const fetchConfiguration = useCallback(async (): Promise<UseWalletsReturn['configuration']> => {
    try {
      const response = await fetch('/api/wallets/configuration');
      const result: ApiResponse<UseWalletsReturn['configuration']> = await response.json();
      
      if (result.ok && result.data) {
        return result.data;
      } else if (result.error === 'NOT_INITIALIZED') {
        return null;
      } else {
        console.warn('Failed to fetch configuration:', result.error);
        return null;
      }
    } catch (error) {
      console.warn('Failed to fetch configuration:', error);
      return null;
    }
  }, []);

  const initializeWallets = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/wallets/init', { method: 'POST' });
      const result: ApiResponse<WalletsApiData> = await response.json();
      
      if (result.ok && result.data) {
        setWallets(result.data);
        saveToCache(result.data);
        // Load balances after wallets are initialized
        try {
          const response = await fetch('/api/wallets/balances');
          const result = await response.json();
          if (result.ok && result.data) {
            setBalances(result.data);
          }
        } catch (err) {
          console.error('Failed to load balances after initialization:', err);
        }
      } else {
        throw new Error(result.error || 'Failed to initialize wallets');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize wallets';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [saveToCache]);

  const refreshWallets = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchWallets();
      if (data) {
        setWallets(data);
        saveToCache(data);
      } else {
        setWallets(null);
        // Clear cache when no wallets exist
        localStorage.removeItem(CACHE_KEY);
      }
      
      // Also fetch configuration status
      const config = await fetchConfiguration();
      setConfiguration(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh wallets';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchWallets, saveToCache, fetchConfiguration]);

  const refreshBalances = useCallback(async () => {
    try {
      console.log('Loading balances...');
      const response = await fetch('/api/wallets/balances');
      const result: ApiResponse<BalancesApiData> = await response.json();

      if (result.ok && result.data) {
        console.log('Balances loaded successfully:', result.data);
        setBalances(result.data);
      } else {
        console.error('Failed to load balances:', result.error);
      }
    } catch (err) {
      console.error('Network error loading balances:', err);
    }
  }, []);

  const fundWallet = useCallback(async (role: string) => {
    try {
      const response = await fetch('/api/wallets/fund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      const result: ApiResponse = await response.json();

      if (result.ok) {
        // Refresh balances after successful funding
        await refreshBalances();
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to fund wallet' };
      }
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, [refreshBalances]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setWallets(null);
    setBalances(null);
    setConfiguration(null);
    setError(null);
  }, []);

  // Load wallets on mount
  useEffect(() => {
    const cached = loadFromCache();
    if (cached) {
      setWallets(cached);
      // Load balances when wallets are available
      refreshBalances();
      // Load configuration status
      fetchConfiguration().then(setConfiguration);
    } else {
      refreshWallets();
    }
  }, [loadFromCache, refreshWallets, refreshBalances, fetchConfiguration]);

  return {
    wallets,
    balances,
    configuration,
    loading,
    error,
    initializeWallets,
    refreshWallets,
    refreshBalances,
    fundWallet,
    clearCache
  };
}
