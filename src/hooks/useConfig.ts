import { useState, useEffect, useCallback } from 'react';

interface ConfigData {
  minXrp: number;
  network: string;
  currencyCode: string;
  trustLimit: string;
  requireAuth: boolean;
  noFreeze: boolean;
  autoFaucet: boolean;
  sourceTag: number;
  defaultIssue: string;
  defaultDistribute: string;
}

interface UseConfigReturn {
  config: ConfigData | null;
  loading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
}

export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/config');
      const result = await response.json();

      if (result.ok && result.data) {
        setConfig(result.data);
      } else {
        setError(result.error || 'Failed to load configuration');
      }
    } catch {
      setError('Network error loading configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    refreshConfig: fetchConfig
  };
}
