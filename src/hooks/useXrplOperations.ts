import { useState, useEffect } from 'react';

interface IssuerFlagsData {
  issuer: {
    address: string;
    flags: {
      defaultRipple: boolean;
      requireAuth: boolean;
      noFreeze: boolean;
    };
  };
  changed: boolean;
  funding?: {
    status: 'ok' | 'funded' | 'error';
    address: string;
    balanceXrp?: number;
  };
}

interface TrustLineResult {
  role: 'hot' | 'seller' | 'buyer';
  address: string;
  created: boolean;
  txHash?: string;
  funding?: {
    status: 'ok' | 'funded' | 'error';
    address: string;
    balanceXrp?: number;
  };
}

interface TrustLinesData {
  currency: string;
  limit: string;
  results: TrustLineResult[];
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const ISSUER_FLAGS_CACHE_KEY = 'xrpl_issuer_flags_cached_v1';
const TRUST_LINES_CACHE_KEY = 'xrpl_trust_lines_cached_v1';

export function useXrplOperations() {
  const [issuerFlagsLoading, setIssuerFlagsLoading] = useState(false);
  const [trustLinesLoading, setTrustLinesLoading] = useState(false);
  const [issuerFlagsData, setIssuerFlagsData] = useState<IssuerFlagsData | null>(null);
  const [trustLinesData, setTrustLinesData] = useState<TrustLinesData | null>(null);
  const [issuerFlagsError, setIssuerFlagsError] = useState<string | null>(null);
  const [trustLinesError, setTrustLinesError] = useState<string | null>(null);

  // Load cached data on mount
  useEffect(() => {
    const loadCachedData = () => {
      try {
        // Load issuer flags data
        const cachedIssuerFlags = localStorage.getItem(ISSUER_FLAGS_CACHE_KEY);
        if (cachedIssuerFlags) {
          setIssuerFlagsData(JSON.parse(cachedIssuerFlags));
        }

        // Load trust lines data
        const cachedTrustLines = localStorage.getItem(TRUST_LINES_CACHE_KEY);
        if (cachedTrustLines) {
          setTrustLinesData(JSON.parse(cachedTrustLines));
        }
      } catch (error) {
        console.warn('Failed to load cached XRPL operations data:', error);
      }
    };

    loadCachedData();
  }, []);

  // Helper functions for cache management
  const saveIssuerFlagsToCache = (data: IssuerFlagsData) => {
    try {
      localStorage.setItem(ISSUER_FLAGS_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save issuer flags to cache:', error);
    }
  };

  const saveTrustLinesToCache = (data: TrustLinesData) => {
    try {
      localStorage.setItem(TRUST_LINES_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save trust lines to cache:', error);
    }
  };

  const clearCache = () => {
    try {
      localStorage.removeItem(ISSUER_FLAGS_CACHE_KEY);
      localStorage.removeItem(TRUST_LINES_CACHE_KEY);
      setIssuerFlagsData(null);
      setTrustLinesData(null);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  };

  const setIssuerFlags = async () => {
    setIssuerFlagsLoading(true);
    setIssuerFlagsError(null);

    try {
      const response = await fetch('/api/xrpl/issuer/flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<IssuerFlagsData> = await response.json();

      if (result.ok && result.data) {
        setIssuerFlagsData(result.data);
        saveIssuerFlagsToCache(result.data);
      } else {
        setIssuerFlagsError(result.error || 'Failed to set issuer flags');
      }
          } catch {
        setIssuerFlagsError('Network error occurred');
      } finally {
      setIssuerFlagsLoading(false);
    }
  };

  const createTrustLines = async () => {
    setTrustLinesLoading(true);
    setTrustLinesError(null);

    try {
      const response = await fetch('/api/xrpl/trustlines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<TrustLinesData> = await response.json();

      if (result.ok && result.data) {
        setTrustLinesData(result.data);
        saveTrustLinesToCache(result.data);
      } else {
        setTrustLinesError(result.error || 'Failed to create trust lines');
      }
          } catch {
        setTrustLinesError('Network error occurred');
      } finally {
      setTrustLinesLoading(false);
    }
  };

  const resetIssuerFlags = () => {
    setIssuerFlagsData(null);
    setIssuerFlagsError(null);
    try {
      localStorage.removeItem(ISSUER_FLAGS_CACHE_KEY);
    } catch (error) {
      console.warn('Failed to clear issuer flags cache:', error);
    }
  };

  const resetTrustLines = () => {
    setTrustLinesData(null);
    setTrustLinesError(null);
    try {
      localStorage.removeItem(TRUST_LINES_CACHE_KEY);
    } catch (error) {
      console.warn('Failed to clear trust lines cache:', error);
    }
  };

  return {
    // Issuer Flags
    issuerFlagsLoading,
    issuerFlagsData,
    issuerFlagsError,
    setIssuerFlags,
    resetIssuerFlags,
    
    // Trust Lines
    trustLinesLoading,
    trustLinesData,
    trustLinesError,
    createTrustLines,
    resetTrustLines,
    
    // Cache management
    clearCache
  };
}
