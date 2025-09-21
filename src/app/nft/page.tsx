'use client';

import { useNFT } from '@/hooks/useNFT';
import { useWallets } from '@/hooks/useWallets';
import { useStablecoinOperations } from '@/hooks/useStablecoinOperations';
import { useToast } from '@/hooks/useToast';
import { CopyButton } from '@/components/CopyButton';
import ToastContainer from '@/components/ToastContainer';
import Header from '@/components/Header';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import { generateIdempotencyKey } from '@/lib/idempotency-helper';
import { useState, useEffect } from 'react';

export default function NFTPage() {
  const { wallets, loading: walletsLoading } = useWallets();
  const { balancesData, fetchBalances } = useStablecoinOperations();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  
  const {
    mintLoading,
    mintError,
    mint,
    listLoading,
    sellerNFTs,
    buyerNFTs,
    refreshSellerNFTs,
    refreshBuyerNFTs,
    createOfferLoading,
    createOfferError,
    createOffer,
    listOffersLoading,
    offers,
    refreshOffers,
    acceptOfferLoading,
    acceptOfferError,
    acceptOffer,
    cancelOffer,
    burnLoading,
    burnError,
    burn,
  } = useNFT();

  const [mintUri, setMintUri] = useState('');
  const [mintTransferable, setMintTransferable] = useState(true);
  const [mintTaxon, setMintTaxon] = useState(0);
  const [mintIdempotency, setMintIdempotency] = useState('');
  const [offerNftokenId, setOfferNftokenId] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerIdempotency, setOfferIdempotency] = useState('');
  const [acceptOfferIndex, setAcceptOfferIndex] = useState('');
  const [acceptIdempotency, setAcceptIdempotency] = useState('');
  const [cancelingOfferIndex, setCancelingOfferIndex] = useState<string | null>(null);
  const [burnNftokenId, setBurnNftokenId] = useState('');
  const [burnRole, setBurnRole] = useState<'seller' | 'buyer'>('seller');
  const [burnIdempotency, setBurnIdempotency] = useState('');
  const [burningNftokenId, setBurningNftokenId] = useState<string | null>(null);

  // Set page title
  useEffect(() => {
    document.title = "NFT Operations - XRPL Stablecoin POC";
  }, []);

  // Load NFTs and balances on mount
  useEffect(() => {
    if (wallets) {
      refreshSellerNFTs();
      refreshBuyerNFTs();
      refreshOffers();
      fetchBalances();
    }
  }, [wallets, refreshSellerNFTs, refreshBuyerNFTs, refreshOffers, fetchBalances]);

  const handleMint = async () => {
    if (!mintUri.trim()) {
      showError('Please enter a metadata URI');
      return;
    }

    const result = await mint({
      uri: mintUri.trim(),
      transferable: mintTransferable,
      taxon: mintTaxon,
      idempotencyKey: mintIdempotency.trim() || undefined,
    });

    if (result.success) {
      showSuccess(`NFT minted successfully!`, `NFTokenID: ${result.data?.nftokenId}`);
      setMintUri('');
      setMintTaxon(0);
      setMintIdempotency('');
      refreshSellerNFTs();
    } else {
      showError(`Failed to mint NFT: ${result.error}`);
    }
  };

  const handleCreateOffer = async () => {
    if (!offerNftokenId.trim()) {
      showError('Please select an NFT');
      return;
    }

    if (!offerAmount.trim()) {
      showError('Please enter a price');
      return;
    }

    const result = await createOffer({
      nftokenId: offerNftokenId.trim(),
      amount: offerAmount.trim(),
      idempotencyKey: offerIdempotency.trim() || undefined,
    });

    if (result.success) {
      showSuccess(`Sell offer created successfully!`, `Offer Index: ${result.data?.offerIndex}`);
      setOfferNftokenId('');
      setOfferAmount('');
      setOfferIdempotency('');
      refreshOffers();
    } else {
      showError(`Failed to create offer: ${result.error}`);
    }
  };

  const handleAcceptOffer = async () => {
    if (!acceptOfferIndex.trim()) {
      showError('Please enter an offer index');
      return;
    }

    const result = await acceptOffer({
      offerIndex: acceptOfferIndex.trim(),
      idempotencyKey: acceptIdempotency.trim() || undefined,
    });

    if (result.success) {
      showSuccess(`NFT transferred. Payment in SBR completed.`, `TxHash: ${result.data?.txHash}`);
      setAcceptOfferIndex('');
      setAcceptIdempotency('');
      refreshBuyerNFTs();
      
      // Wait a moment for the transaction to be processed on XRPL
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to refresh the offers list multiple times if needed
      let attempts = 0;
      let refreshed = false;
      
      while (attempts < 3 && !refreshed) {
        console.log(`Refreshing offers list after accept, attempt ${attempts + 1}`);
        const refreshResult = await refreshOffers();
        
        if (refreshResult.success) {
          // Check if the accepted offer is still in the list
          const stillExists = refreshResult.data?.offers?.some((offer: { offerIndex: string }) => offer.offerIndex === acceptOfferIndex);
          if (!stillExists) {
            console.log('Accepted offer successfully removed from list');
            refreshed = true;
          } else {
            console.log('Accepted offer still exists, waiting and retrying...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        attempts++;
      }
      
      if (!refreshed) {
        console.log('Could not confirm offer removal, but refresh was attempted');
      }
      
      fetchBalances();
    } else {
      showError(`Failed to accept offer: ${result.error}`);
    }
  };

  const handleCancelOffer = async (offerIndex: string) => {
    if (!confirm('Are you sure you want to cancel this offer?')) {
      return;
    }

    setCancelingOfferIndex(offerIndex);
    
    try {
      const result = await cancelOffer({
        offerIndex,
      });

      if (result.success) {
        showSuccess(`Offer cancelled successfully!`, `TxHash: ${result.data?.txHash}`);
        
        // Wait a moment for the transaction to be processed on XRPL
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try to refresh the offers list multiple times if needed
        let attempts = 0;
        let refreshed = false;
        
        while (attempts < 3 && !refreshed) {
          console.log(`Refreshing offers list, attempt ${attempts + 1}`);
          const refreshResult = await refreshOffers();
          
          if (refreshResult.success) {
            // Check if the cancelled offer is still in the list
            const stillExists = refreshResult.data?.offers?.some((offer: { offerIndex: string }) => offer.offerIndex === offerIndex);
            if (!stillExists) {
              console.log('Offer successfully removed from list');
              refreshed = true;
            } else {
              console.log('Offer still exists, waiting and retrying...');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          attempts++;
        }
        
        if (!refreshed) {
          console.log('Could not confirm offer removal, but refresh was attempted');
        }
      } else {
        showError(`Failed to cancel offer: ${result.error}`);
      }
    } finally {
      setCancelingOfferIndex(null);
    }
  };

  const handleBurn = async () => {
    if (!burnNftokenId.trim()) {
      showError('Please select an NFT to burn');
      return;
    }

    if (!confirm(`Are you sure you want to burn this NFT? This action is IRREVERSIBLE!\n\nNFTokenID: ${burnNftokenId}`)) {
      return;
    }

    setBurningNftokenId(burnNftokenId);
    
    try {
    const result = await burn({
      nftokenId: burnNftokenId.trim(),
      role: burnRole,
      idempotencyKey: burnIdempotency.trim() || undefined,
    });

      if (result.success) {
        showSuccess(`NFT burned successfully!`, `TxHash: ${result.data?.txHash}`);
        setBurnNftokenId('');
        setBurnRole('seller');
        setBurnIdempotency('');
        refreshSellerNFTs();
        refreshBuyerNFTs();
        fetchBalances();
      } else {
        showError(`Failed to burn NFT: ${result.error}`);
      }
    } finally {
      setBurningNftokenId(null);
    }
  };

  if (walletsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">NFT Operations</h1>
            <div className="text-center py-8">
              <p className="text-gray-500">Loading wallets...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!wallets) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">NFT Operations</h1>
            <p className="text-gray-500 mb-6">Please initialize wallets first in the setup page.</p>
            <div className="space-x-4">
              <Button
                onClick={() => window.location.href = '/setup'}
                type="primary"
              >
                Go to Setup Page
              </Button>
              <Button
                onClick={() => {
                  localStorage.removeItem('xrpl_wallets_cached_v1');
                  window.location.reload();
                }}
                type="secondary"
              >
                Clear Cache & Reload
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">NFT Operations (XLS-20)</h1>
          <Button
            onClick={() => window.location.href = '/nft-gallery'}
            type="primary"
          >
            NFT Gallery →
          </Button>
        </div>

        {/* Balances Section */}
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Balances</h2>
            <Button
              onClick={fetchBalances}
              disabled={listLoading}
              type="secondary"
              size="sm"
            >
              {listLoading ? 'Loading...' : 'Refresh Balances'}
            </Button>
          </div>

          {balancesData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Seller</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">XRP:</span>
                    <span className="font-mono text-gray-900">{balancesData.entries.find(b => b.role === 'seller')?.xrp || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SBR:</span>
                    <span className="font-mono text-gray-900">{balancesData.entries.find(b => b.role === 'seller')?.sbr || '0'}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Buyer</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">XRP:</span>
                    <span className="font-mono text-gray-900">{balancesData.entries.find(b => b.role === 'buyer')?.xrp || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SBR:</span>
                    <span className="font-mono text-gray-900">{balancesData.entries.find(b => b.role === 'buyer')?.sbr || '0'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Loading balances...</div>
          )}
        </Card>

        {/* Mint NFT Section */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Mint NFT</h2>

          {mintError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {mintError}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Metadata URI"
              type="text"
              value={mintUri}
              onChange={(e) => setMintUri(e.target.value)}
              placeholder="ipfs://... or https://..."
            />

            <div className="flex items-center">
              <input
                type="checkbox"
                id="transferable"
                checked={mintTransferable}
                onChange={(e) => setMintTransferable(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="transferable" className="ml-2 text-sm text-gray-700 cursor-pointer">
                Transferable
              </label>
            </div>

            <div>
              <Input
                label="Collection Taxon (0-4294967295)"
                type="number"
                value={mintTaxon}
                onChange={(e) => setMintTaxon(Number(e.target.value))}
                min="0"
                max="4294967295"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                NFTs with the same taxon belong to the same collection
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idempotency key (optional)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={mintIdempotency}
                  onChange={(e) => setMintIdempotency(e.target.value)}
                  placeholder="e.g., mint-001"
                  className="input flex-1"
                />
                <Button
                  onClick={async () => setMintIdempotency(await generateIdempotencyKey('mint'))}
                  type="secondary"
                  size="sm"
                >
                  Auto
                </Button>
              </div>
            </div>

            <Button
              onClick={handleMint}
              disabled={mintLoading}
              type="primary"
            >
              {mintLoading ? 'Minting...' : 'Mint NFT'}
            </Button>
          </div>

          {/* Seller NFTs Table */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Seller NFTs</h3>
              <Button
                onClick={refreshSellerNFTs}
                disabled={listLoading}
                type="secondary"
                size="sm"
              >
                {listLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {sellerNFTs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">NFTokenID</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">URI</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerNFTs.map((nft) => (
                      <tr key={nft.nftokenId} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-mono text-sm text-gray-900">
                          {nft.nftokenId}
                        </td>
                        <td className="py-2 px-3 text-sm text-gray-900">
                          {nft.uri || 'N/A'}
                        </td>
                        <td className="py-2 px-3">
                          <CopyButton text={nft.nftokenId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No NFTs found</div>
            )}
          </div>
        </Card>

        {/* Create Offer Section */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Create Sell Offer (SBR)</h2>

          {createOfferError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {createOfferError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select NFT
              </label>
              <select
                value={offerNftokenId}
                onChange={(e) => setOfferNftokenId(e.target.value)}
                className="input w-full cursor-pointer"
              >
                <option value="">Choose an NFT...</option>
                {sellerNFTs.map((nft) => (
                  <option key={nft.nftokenId} value={nft.nftokenId}>
                    {nft.nftokenId} {nft.uri ? `(${nft.uri})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Price (SBR)"
              type="text"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="Enter price in SBR"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idempotency key (optional)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={offerIdempotency}
                  onChange={(e) => setOfferIdempotency(e.target.value)}
                  placeholder="e.g., offer-001"
                  className="input flex-1"
                />
                <Button
                  onClick={async () => setOfferIdempotency(await generateIdempotencyKey('offer'))}
                  type="secondary"
                  size="sm"
                >
                  Auto
                </Button>
              </div>
            </div>

            <Button
              onClick={handleCreateOffer}
              disabled={createOfferLoading || !offerNftokenId || !offerAmount}
              type="success"
            >
              {createOfferLoading ? 'Creating offer...' : 'Create sell offer'}
            </Button>
          </div>

          {/* Seller Offers Table */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Seller Offers</h3>
              <Button
                onClick={refreshOffers}
                disabled={listOffersLoading}
                type="secondary"
                size="sm"
              >
                {listOffersLoading ? 'Loading...' : 'Refresh Offers'}
              </Button>
            </div>

            {offers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Offer Index</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">NFTokenID</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Price</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => (
                      <tr key={offer.offerIndex} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-mono text-sm text-gray-900">
                          {offer.offerIndex}
                        </td>
                        <td className="py-2 px-3 font-mono text-sm text-gray-900">
                          {offer.nftokenId}
                        </td>
                        <td className="py-2 px-3 font-mono text-sm text-gray-900">
                          {offer.amount} SBR
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center space-x-2">
                            <CopyButton text={offer.offerIndex} />
                            <Button
                              onClick={() => handleCancelOffer(offer.offerIndex)}
                              disabled={cancelingOfferIndex === offer.offerIndex}
                              type="danger"
                              size="sm"
                            >
                              {cancelingOfferIndex === offer.offerIndex ? 'Canceling...' : 'Cancel'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No offers found</div>
            )}
          </div>
        </Card>

        {/* Accept Offer Section */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Accept Offer (Buyer)</h2>

          {acceptOfferError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {acceptOfferError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Offer Index
              </label>
              <select
                value={acceptOfferIndex}
                onChange={(e) => setAcceptOfferIndex(e.target.value)}
                className="input w-full cursor-pointer"
              >
                <option value="">Choose an offer...</option>
                {offers.map((offer) => (
                  <option key={offer.offerIndex} value={offer.offerIndex}>
                    {offer.offerIndex} - {offer.amount} SBR
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Or paste an offer index manually
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idempotency key (optional)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={acceptIdempotency}
                  onChange={(e) => setAcceptIdempotency(e.target.value)}
                  placeholder="e.g., accept-001"
                  className="input flex-1"
                />
                <Button
                  onClick={async () => setAcceptIdempotency(await generateIdempotencyKey('accept'))}
                  type="secondary"
                  size="sm"
                >
                  Auto
                </Button>
              </div>
            </div>

            <Button
              onClick={handleAcceptOffer}
              disabled={acceptOfferLoading || !acceptOfferIndex}
              type="primary"
            >
              {acceptOfferLoading ? 'Accepting offer...' : 'Accept offer (Buyer)'}
            </Button>
          </div>

          {/* Buyer NFTs Table */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Buyer NFTs</h3>
              <Button
                onClick={refreshBuyerNFTs}
                disabled={listLoading}
                type="secondary"
                size="sm"
              >
                {listLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {buyerNFTs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">NFTokenID</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">URI</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyerNFTs.map((nft) => (
                      <tr key={nft.nftokenId} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-mono text-sm text-gray-900">
                          {nft.nftokenId}
                        </td>
                        <td className="py-2 px-3 text-sm text-gray-900">
                          {nft.uri || 'N/A'}
                        </td>
                        <td className="py-2 px-3">
                          <CopyButton text={nft.nftokenId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No NFTs found</div>
            )}
          </div>
        </Card>

        {/* Burn NFT Section */}
        <Card className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Burn NFT (Seller/Buyer)</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Warning</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>Burning an NFT is <strong>IRREVERSIBLE</strong>. Once burned, the NFT will be permanently destroyed and cannot be recovered.</p>
                </div>
              </div>
            </div>
          </div>

          {burnError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {burnError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Owner
              </label>
              <select
                value={burnRole}
                onChange={(e) => {
                  setBurnRole(e.target.value as 'seller' | 'buyer');
                  setBurnNftokenId(''); // Clear NFT selection when changing role
                }}
                className="input w-full cursor-pointer"
              >
                <option value="seller">Seller NFTs</option>
                <option value="buyer">Buyer NFTs</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select NFT to Burn
              </label>
              <select
                value={burnNftokenId}
                onChange={(e) => setBurnNftokenId(e.target.value)}
                className="input w-full cursor-pointer"
              >
                <option value="">Choose an NFT to burn...</option>
                {(burnRole === 'seller' ? sellerNFTs : buyerNFTs).map((nft) => (
                  <option key={nft.nftokenId} value={nft.nftokenId}>
                    {nft.nftokenId} {nft.uri ? `(${nft.uri})` : ''}
                  </option>
                ))}
              </select>
              {(burnRole === 'seller' ? sellerNFTs : buyerNFTs).length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  No NFTs found for {burnRole}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idempotency key (optional)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={burnIdempotency}
                  onChange={(e) => setBurnIdempotency(e.target.value)}
                  placeholder="e.g., burn-001"
                  className="input flex-1"
                />
                <Button
                  onClick={async () => setBurnIdempotency(await generateIdempotencyKey('burn'))}
                  type="secondary"
                  size="sm"
                >
                  Auto
                </Button>
              </div>
            </div>

            <Button
              onClick={handleBurn}
              disabled={burnLoading || !burnNftokenId || burningNftokenId === burnNftokenId}
              type="danger"
            >
              {burnLoading || burningNftokenId === burnNftokenId ? 'Burning NFT...' : 'Burn NFT (IRREVERSIBLE)'}
            </Button>
          </div>
        </Card>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
