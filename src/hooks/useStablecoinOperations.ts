import { useState, useCallback } from 'react';

interface IssueRequest {
  amount?: string;
  idempotencyKey?: string;
}

interface DistributeRequest {
  amount?: string;
  idempotencyKey?: string;
}

interface TransactionResponse {
  txHash: string;
  amount: string;
  currency: string;
  from: string;
  to: string;
}

interface BalanceEntry {
  role: 'issuer' | 'hot' | 'seller' | 'buyer';
  address: string;
  xrp: string;
  sbr?: string;
}

interface BalancesResponse {
  currency: string;
  entries: BalanceEntry[];
}

export function useStablecoinOperations() {
  const [issueLoading, setIssueLoading] = useState(false);
  const [distributeLoading, setDistributeLoading] = useState(false);
  const [balancesLoading, setBalancesLoading] = useState(false);
  
  const [issueData, setIssueData] = useState<TransactionResponse | null>(null);
  const [distributeData, setDistributeData] = useState<TransactionResponse | null>(null);
  const [balancesData, setBalancesData] = useState<BalancesResponse | null>(null);
  
  const [issueError, setIssueError] = useState<string | null>(null);
  const [distributeError, setDistributeError] = useState<string | null>(null);
  const [balancesError, setBalancesError] = useState<string | null>(null);

  const issue = useCallback(async (request: IssueRequest) => {
    setIssueLoading(true);
    setIssueError(null);

    try {
      const response = await fetch('/api/xrpl/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.ok && result.data) {
        setIssueData(result.data);
        return { success: true, data: result.data };
      } else {
        setIssueError(result.error || 'Failed to issue SBR');
        return { success: false, error: result.error || 'Failed to issue SBR' };
      }
    } catch {
      const errorMessage = 'Network error during issue';
      setIssueError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIssueLoading(false);
    }
  }, []);

  const distribute = useCallback(async (request: DistributeRequest) => {
    setDistributeLoading(true);
    setDistributeError(null);

    try {
      const response = await fetch('/api/xrpl/distribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.ok && result.data) {
        setDistributeData(result.data);
        return { success: true, data: result.data };
      } else {
        setDistributeError(result.error || 'Failed to distribute SBR');
        return { success: false, error: result.error || 'Failed to distribute SBR' };
      }
    } catch {
      const errorMessage = 'Network error during distribute';
      setDistributeError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setDistributeLoading(false);
    }
  }, []);

  const fetchBalances = useCallback(async () => {
    setBalancesLoading(true);
    setBalancesError(null);

    try {
      const response = await fetch('/api/xrpl/balances');
      const result = await response.json();

      if (result.ok && result.data) {
        setBalancesData(result.data);
        return { success: true, data: result.data };
      } else {
        setBalancesError(result.error || 'Failed to fetch balances');
        return { success: false, error: result.error || 'Failed to fetch balances' };
      }
    } catch {
      const errorMessage = 'Network error fetching balances';
      setBalancesError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  return {
    // Issue operations
    issueLoading,
    issueData,
    issueError,
    issue,
    
    // Distribute operations
    distributeLoading,
    distributeData,
    distributeError,
    distribute,
    
    // Balances operations
    balancesLoading,
    balancesData,
    balancesError,
    fetchBalances
  };
}
