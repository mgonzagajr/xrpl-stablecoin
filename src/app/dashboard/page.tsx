'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Card from '@/components/Card';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import { formatSbrBalance, formatCurrencyAmount } from '@/lib/formatters';

interface DashboardMetrics {
  marketCap: {
    currency: string;
    brl: string;
    usd: string;
  };
  volume: {
    currency: string;
    brl: string;
    usd: string;
  };
  totalTransactions: number;
  conversionRate: {
    currencyToBrl: number;
    brlToUsd: number;
    currencyToUsd: number;
  };
  lastUpdated: string;
}

interface TransactionLog {
  hash: string;
  wallet: string;
  walletRole: string;
  type: string;
  sbrAmount?: string;
  date: string;
  fee: string;
  destination?: string;
}


export default function DashboardPage() {
  const { toasts, removeToast, showError } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [transactions, setTransactions] = useState<TransactionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Get currency code from environment or default
  const currencyCode = 'SBR';

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/metrics');
      const result = await response.json();
      
      if (result.ok) {
        setMetrics(result.data);
      } else {
        showError('Error loading metrics: ' + result.error);
      }
    } catch {
      showError('Error loading metrics');
    }
  }, [showError]);

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch('/api/transactions/source-tag');
      const result = await response.json();
      
      if (result.ok) {
        setTransactions(result.data.transactions);
      } else {
        showError('Error loading transactions: ' + result.error);
      }
    } catch {
      showError('Error loading transactions');
    }
  }, [showError]);



  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 8)}...${wallet.slice(-8)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };


  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchMetrics(), fetchTransactions()]);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMetrics();
      fetchTransactions();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchMetrics, fetchTransactions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-20">
              <div className="text-xl text-gray-600">Loading dashboard...</div>
              <div className="text-sm text-gray-500 mt-2">
                Metrics: {metrics ? 'Loaded' : 'Loading...'} | 
                Transactions: {transactions.length}
              </div>
            </div>
        </main>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Dashboard <span className="text-gradient">{currencyCode}</span>
          </h1>
          <p className="text-gray-600">
            Monitor {currencyCode} stablecoin and source tag transactions
          </p>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Market Cap */}
            <Card className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green to-green/80 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Cap</h3>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-green">
                      {formatCurrencyAmount(metrics.marketCap.usd, 'USD')}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatSbrBalance(metrics.marketCap.currency)} {currencyCode}
                    </div>
                  </div>
            </Card>

            {/* Volume */}
            <Card className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple to-purple/80 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">VMT</h3>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-purple">
                      {formatCurrencyAmount(metrics.volume.usd, 'USD')}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatSbrBalance(metrics.volume.currency)} {currencyCode}
                    </div>
                  </div>
            </Card>

            {/* Transactions */}
            <Card className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Transactions</h3>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.totalTransactions.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  Total transactions
                </div>
              </div>
            </Card>

            {/* Conversion Rate */}
            <Card className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💱</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Conversion Rate</h3>
              <div className="space-y-1">
                <div className="text-lg font-bold text-orange-600">
                  1 {currencyCode} = 1 BRL
                </div>
                <div className="text-sm text-gray-600">
                  1 BRL = {metrics.conversionRate.brlToUsd.toFixed(4)} USD
                </div>
                <div className="text-xs text-gray-500">
                  Updated: {new Date(metrics.lastUpdated).toLocaleString('en-US')}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Source Tag Activity Log */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Source Tag Activity Log</h2>
            <div className="text-sm text-gray-600">
              Source Tag: <span className="font-mono font-semibold text-purple">846813574</span>
              <span className="ml-2 text-gray-500">({transactions.length} transactions)</span>
            </div>
          </div>
          
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hash
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wallet
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {currencyCode} Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fee
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx, index) => (
                    <tr key={tx.hash} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                        <span title={tx.hash}>{formatHash(tx.hash)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                        <div className="flex flex-col">
                          <span title={tx.wallet}>{formatWallet(tx.wallet)}</span>
                          <span className="text-xs text-gray-500 capitalize">{tx.walletRole}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          tx.type === 'Payment' ? 'bg-green-100 text-green-800' :
                          tx.type === 'TrustSet' ? 'bg-blue-100 text-blue-800' :
                          tx.type === 'OfferCreate' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tx.sbrAmount ? (
                          <span className="font-semibold text-green-600">
                            {formatSbrBalance(tx.sbrAmount)} {currencyCode}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tx.fee} XRP
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <div className="text-gray-500 text-lg mb-2">No transactions found</div>
              <div className="text-sm text-gray-400">
                No transactions with source tag 846813574 found in recent history
              </div>
            </div>
          )}
        </Card>

      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
