'use client';

import { useEffect } from 'react';
import { useWallets } from '@/hooks/useWallets';
import { useXrplOperations } from '@/hooks/useXrplOperations';
import { useStablecoinOperations } from '@/hooks/useStablecoinOperations';
import { useConfig } from '@/hooks/useConfig';
import { useToast } from '@/hooks/useToast';
import { CopyButton } from '@/components/CopyButton';
import ToastContainer from '@/components/ToastContainer';
import Header from '@/components/Header';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { generateIdempotencyKey } from '@/lib/idempotency-helper';

export default function SetupPage() {
  const { wallets, balances, loading, error, initializeWallets, refreshWallets, refreshBalances, clearCache } = useWallets();
  const { config } = useConfig();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const {
    issueLoading,
    issue,
    distributeLoading,
    distribute,
    balancesLoading,
    balancesData,
    balancesError,
    fetchBalances
  } = useStablecoinOperations();
  
  // Get minimum XRP from config (default to 10)
  const minXrp = config?.minXrp || 10;
  const {
    issuerFlagsLoading,
    issuerFlagsData,
    issuerFlagsError,
    setIssuerFlags,
    trustLinesLoading,
    trustLinesData,
    trustLinesError,
    createTrustLines,
    clearCache: clearXrplCache
  } = useXrplOperations();

  const handleInitialize = async () => {
    await initializeWallets();
  };

  const handleRefresh = async () => {
    await refreshWallets();
  };

  const handleClearCache = () => {
    clearCache(); // Clear wallets cache
    clearXrplCache(); // Clear XRPL operations cache
    showSuccess('Cache limpo com sucesso!');
  };

  const handleSetIssuerFlags = async () => {
    await setIssuerFlags();
    // Success/error handling is done in the hook via state
  };

  const handleCreateTrustLines = async () => {
    await createTrustLines();
    // Success/error handling is done in the hook via state
  };

  const handleIssue = async () => {
    const issueAmount = (document.getElementById('issueAmount') as HTMLInputElement)?.value || config?.defaultIssue || '1000000';
    const idempotencyKey = (document.getElementById('issueIdempotency') as HTMLInputElement)?.value || await generateIdempotencyKey('issue');
    
    const result = await issue({ amount: issueAmount, idempotencyKey });
    if (result.success) {
      showSuccess(`Issued ${issueAmount} ${config?.currencyCode || 'SBR'} to hot wallet!`, `TxHash: ${result.data?.txHash}`);
      fetchBalances();
    } else {
      showError(`Failed to issue ${config?.currencyCode || 'SBR'}: ${result.error}`);
    }
  };

  const handleDistribute = async () => {
    const distributeAmount = (document.getElementById('distributeAmount') as HTMLInputElement)?.value || config?.defaultDistribute || '100';
    const idempotencyKey = (document.getElementById('distributeIdempotency') as HTMLInputElement)?.value || await generateIdempotencyKey('distribute');
    
    const result = await distribute({ amount: distributeAmount, idempotencyKey });
    if (result.success) {
      showSuccess(`Distributed ${distributeAmount} ${config?.currencyCode || 'SBR'} to buyer!`, `TxHash: ${result.data?.txHash}`);
      fetchBalances();
    } else {
      showError(`Failed to distribute ${config?.currencyCode || 'SBR'}: ${result.error}`);
    }
  };

  const handleAutoIssueIdempotency = async () => {
    const key = await generateIdempotencyKey('issue');
    (document.getElementById('issueIdempotency') as HTMLInputElement).value = key;
  };

  const handleAutoDistributeIdempotency = async () => {
    const key = await generateIdempotencyKey('distribute');
    (document.getElementById('distributeIdempotency') as HTMLInputElement).value = key;
  };

  // Set page title
  useEffect(() => {
    document.title = "Setup - XRPL Stablecoin POC";
  }, []);

  // Auto-fetch balances when wallets are available
  useEffect(() => {
    if (wallets && !balancesData) {
      fetchBalances();
    }
  }, [wallets, balancesData, fetchBalances]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Initialization Section */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Wallet Initialization</h2>
              <p className="text-gray-600 mt-1">Generate and configure your XRPL wallets</p>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={handleInitialize}
                disabled={loading}
                type="primary"
              >
                {loading ? 'Initializing...' : 'Initialize Wallets'}
              </Button>
              
              <Button
                onClick={handleClearCache}
                type="secondary"
              >
                Clear Cache
              </Button>
              
              {wallets && (
                <Button
                  onClick={handleRefresh}
                  disabled={loading}
                  type="secondary"
                >
                  Refresh
                </Button>
              )}
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-red-500 mr-2">⚠️</span>
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}
          
          {wallets && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  <span className="text-green-700">Wallets initialized successfully! All wallets are funded on TESTNET.</span>
                </div>
                <Button
                  onClick={refreshBalances}
                  disabled={loading}
                  type="secondary"
                  size="sm"
                  className="text-xs bg-green-100 text-green-700 hover:bg-green-200"
                >
                  Refresh Balances
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Wallets Section */}
        {wallets && (
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Generated Wallets</h2>
              <div className="flex space-x-2">
                <span className="badge badge-info">{wallets.network}</span>
                <span className="badge badge-info">Source Tag: {wallets.sourceTag}</span>
              </div>
            </div>

            {/* Funding Info */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Funding Information</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• <strong>TESTNET:</strong> Wallets are automatically funded with faucet</p>
                <p>• <strong>MAINNET:</strong> You need to fund wallets manually with real XRP</p>
                <p>• <strong>Minimum XRP:</strong> {minXrp} XRP required for transactions</p>
              </div>
            </div>

            {/* Wallets Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Address</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">XRP Balance</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Explorer</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.wallets.map((wallet) => {
                    const balance = balances?.balances?.find(b => b.address === wallet.address);
                    const needsFunding = balance && balance.balanceXrp < minXrp;
                    const explorerUrl = wallets.network === 'MAINNET' 
                      ? `https://livenet.xrpl.org/accounts/${wallet.address}`
                      : `https://testnet.xrpl.org/accounts/${wallet.address}`;
                    
                    return (
                      <tr key={wallet.role} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900 capitalize">{wallet.role}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {wallet.address}
                            </code>
                            <CopyButton text={wallet.address} />
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {balance ? (
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-sm">
                                {balance.balanceXrp.toFixed(6)} XRP
                              </span>
                              {needsFunding && (
                                <span className="badge badge-warning">Needs Funding</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Loading...</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                            title={`View ${wallet.role} wallet on XRPL Explorer`}
                          >
                            <svg 
                              className="w-4 h-4" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                              />
                            </svg>
                            <span className="text-xs">View</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* XRPL Configuration Section */}
        {wallets && (
          <div className="card mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">XRPL Configuration</h2>
            
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Issuer Flags */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Issuer Flags</h3>
                  {issuerFlagsData && !issuerFlagsData._cached && (
                    <span className="badge badge-success">Configured</span>
                  )}
                  {issuerFlagsData && issuerFlagsData._cached && (
                    <span className="badge badge-warning">Cached</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Configure issuer account flags for token operations
                </p>
                
                {issuerFlagsData && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-sm font-medium text-green-900 mb-2">Current Configuration:</h4>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>• <strong>Default Ripple:</strong> {issuerFlagsData.issuer.flags.defaultRipple ? 'Enabled' : 'Disabled'}</p>
                      <p>• <strong>Require Auth:</strong> {issuerFlagsData.issuer.flags.requireAuth ? 'Enabled' : 'Disabled'}</p>
                      <p>• <strong>No Freeze:</strong> {issuerFlagsData.issuer.flags.noFreeze ? 'Enabled' : 'Disabled'}</p>
                    </div>
                  </div>
                )}
                
                {issuerFlagsError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {issuerFlagsError}
                  </div>
                )}
                
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={handleSetIssuerFlags}
                    disabled={issuerFlagsLoading}
                    type="primary"
                  >
                    {issuerFlagsLoading ? 'Setting...' : 'Set Issuer Flags'}
                  </Button>
                </div>
              </div>

              {/* Trust Lines */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Trust Lines</h3>
                  {trustLinesData && !trustLinesData._cached && (
                    <span className="badge badge-success">Created</span>
                  )}
                  {trustLinesData && trustLinesData._cached && (
                    <span className="badge badge-warning">Cached</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Create trust lines for {config?.currencyCode || 'SBR'} token operations
                </p>
                
                {trustLinesData && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-sm font-medium text-green-900 mb-2">Trust Lines Created:</h4>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>• <strong>Currency:</strong> {trustLinesData.currency}</p>
                      <p>• <strong>Limit:</strong> {trustLinesData.limit}</p>
                      <p>• <strong>Wallets:</strong> {trustLinesData.results.length} configured</p>
                    </div>
                  </div>
                )}
                
                {trustLinesError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {trustLinesError}
                  </div>
                )}
                
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={handleCreateTrustLines}
                    disabled={trustLinesLoading}
                    type="primary"
                  >
                    {trustLinesLoading ? 'Creating...' : 'Create Trust Lines'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stablecoin Operations Section */}
        {wallets && (
          <div className="card mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Stablecoin Operations ({config?.currencyCode || 'SBR'})</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Issue SBR */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Issue {config?.currencyCode || 'SBR'} to Hot</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Issue {config?.currencyCode || 'SBR'} tokens from issuer to hot wallet
                </p>
                
                <div className="space-y-4">
                  <Input
                    id="issueAmount"
                    label="Amount"
                    type="text"
                    placeholder="Enter amount"
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Idempotency Key
                    </label>
                    <div className="flex space-x-2">
                      <input
                        id="issueIdempotency"
                        type="text"
                        className="input flex-1"
                        placeholder="Optional idempotency key"
                      />
                      <Button
                        onClick={handleAutoIssueIdempotency}
                        type="secondary"
                        size="sm"
                      >
                        Auto
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleIssue}
                    disabled={issueLoading}
                    type="success"
                    className="w-full"
                  >
                    {issueLoading ? 'Issuing...' : `Issue ${config?.currencyCode || 'SBR'} to Hot`}
                  </Button>
                </div>
              </div>

              {/* Distribute SBR */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribute {config?.currencyCode || 'SBR'} to Buyer</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Transfer {config?.currencyCode || 'SBR'} tokens from hot to buyer wallet
                </p>
                
                <div className="space-y-4">
                  <Input
                    id="distributeAmount"
                    label="Amount"
                    type="text"
                    placeholder="Enter amount"
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Idempotency Key
                    </label>
                    <div className="flex space-x-2">
                      <input
                        id="distributeIdempotency"
                        type="text"
                        className="input flex-1"
                        placeholder="Optional idempotency key"
                      />
                      <Button
                        onClick={handleAutoDistributeIdempotency}
                        type="secondary"
                        size="sm"
                      >
                        Auto
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleDistribute}
                    disabled={distributeLoading}
                    type="success"
                    className="w-full"
                  >
                    {distributeLoading ? 'Distributing...' : `Distribute ${config?.currencyCode || 'SBR'} to Buyer`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Balances Section */}
        {wallets && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Current Balances</h2>
              <Button
                onClick={fetchBalances}
                disabled={balancesLoading}
                type="secondary"
              >
                {balancesLoading ? 'Refreshing...' : 'Refresh Balances'}
              </Button>
            </div>
            
            {balancesError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {balancesError}
              </div>
            )}
            
            {balancesData && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Address</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">XRP</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">{config?.currencyCode || 'SBR'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balancesData.entries.map((entry) => (
                      <tr key={entry.role} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900 capitalize">{entry.role}</span>
                        </td>
                        <td className="py-3 px-4">
                          <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {entry.address}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm">{entry.xrp} XRP</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm">
                            {entry.sbr || '0'} {config?.currencyCode || 'SBR'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}