'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useWallets } from '@/hooks/useWallets';
import { useNFT } from '@/hooks/useNFT';
import { useToast } from '@/hooks/useToast';
import { useConfig } from '@/hooks/useConfig';
import ToastContainer from '@/components/ToastContainer';
import Header from '@/components/Header';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { CopyButton } from '@/components/CopyButton';
import { getCachedMetadata, setCachedMetadata, clearExpiredCache } from '@/lib/ipfs-cache';
import { ipfsQueue } from '@/lib/ipfs-queue';

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

interface NFTGroup {
  taxon: number;
  nfts: Array<{ nftokenId: string; uri?: string; taxon?: number }>;
  metadata?: NFTMetadata;
  totalCount: number;
}

export default function NFTGalleryPage() {
  const { wallets, loading: walletsLoading } = useWallets();
  const { toasts, removeToast } = useToast();
  const { config } = useConfig();
  const {
    sellerNFTs,
    buyerNFTs,
    refreshSellerNFTs,
    refreshBuyerNFTs,
    listLoading,
  } = useNFT();

  const [selectedTab, setSelectedTab] = useState<'seller' | 'buyer'>('seller');
  const [metadataCache, setMetadataCache] = useState<Record<string, NFTMetadata | null>>({});
  const [loadingMetadata, setLoadingMetadata] = useState<Record<string, boolean>>({});
  const [failedMetadata, setFailedMetadata] = useState<Set<string>>(new Set());
  const [queueStatus, setQueueStatus] = useState({ queueLength: 0, running: 0 });
  const [groupedView, setGroupedView] = useState(true);

  // Generate Bithomp Explorer link for NFT
  const getBithompLink = (nftokenId: string) => {
    const isTestnet = config?.network === 'TESTNET';
    const baseUrl = isTestnet ? 'https://test.bithomp.com' : 'https://bithomp.com';
    return `${baseUrl}/en/nft/${nftokenId}`;
  };

  const fetchMetadata = useCallback(async (uri: string, nftokenId: string): Promise<NFTMetadata | null> => {
    // Check if we already have the metadata or if it failed before
    if (metadataCache[nftokenId] !== undefined) {
      return metadataCache[nftokenId];
    }

    // Don't try again if it failed before
    if (failedMetadata.has(nftokenId)) {
      return null;
    }

    // Check cache first
    const cachedData = getCachedMetadata(nftokenId);
    if (cachedData) {
      console.log(`Using cached metadata for ${nftokenId}`);
      setMetadataCache(prev => ({ ...prev, [nftokenId]: cachedData }));
      return cachedData;
    }

    setLoadingMetadata(prev => ({ ...prev, [nftokenId]: true }));

    try {
      // Use queue to control concurrency
      const result = await ipfsQueue.add(async () => {
        let metadataUrl = uri;
        let lastError: Error | null = null;
        
        // Handle different URI formats
        if (uri.startsWith('ipfs://')) {
          const ipfsHash = uri.replace('ipfs://', '');
          // Try multiple IPFS gateways
          const gateways = [
            `https://ipfs.io/ipfs/${ipfsHash}`,
            `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
            `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
            `https://dweb.link/ipfs/${ipfsHash}`,
          ];
          
          // Try each gateway until one works
          for (const gateway of gateways) {
            try {
              console.log(`Trying IPFS gateway: ${gateway}`);
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              
              const response = await fetch(gateway, { 
                method: 'HEAD', // Just check if resource exists first
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                metadataUrl = gateway;
                console.log(`✓ Gateway ${gateway} is available`);
                break;
              } else {
                // Don't log 404/422/500 as errors - they're expected when content doesn't exist
                if (response.status === 404 || response.status === 422 || response.status >= 500) {
                  console.log(`Gateway ${gateway} returned ${response.status} (content not found)`);
                } else {
                  console.log(`Gateway ${gateway} returned ${response.status}`);
                }
                lastError = new Error(`Gateway ${gateway} returned ${response.status}`);
              }
            } catch (error) {
              lastError = error instanceof Error ? error : new Error('Unknown error');
              console.log(`Gateway ${gateway} failed:`, error instanceof Error ? error.message : 'Unknown error');
              continue;
            }
          }
          
          // If no gateway worked, throw the last error
          if (!metadataUrl.startsWith('http')) {
            throw lastError || new Error('All IPFS gateways failed');
          }
        } else if (uri.startsWith('ar://')) {
          metadataUrl = `https://arweave.net/${uri.replace('ar://', '')}`;
        } else if (!uri.startsWith('http')) {
          // Assume it's a relative path or needs a base URL
          metadataUrl = uri.startsWith('/') ? uri : `/${uri}`;
        }

        console.log(`Fetching metadata from: ${metadataUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(metadataUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const metadata: NFTMetadata = await response.json();
        
        // Process image URLs in metadata to use proper gateways
        if (metadata.image) {
          if (metadata.image.startsWith('ipfs://')) {
            const ipfsHash = metadata.image.replace('ipfs://', '');
            metadata.image = `https://ipfs.io/ipfs/${ipfsHash}`;
          } else if (metadata.image.startsWith('ar://')) {
            metadata.image = `https://arweave.net/${metadata.image.replace('ar://', '')}`;
          }
        }
        
        return metadata;
      }); // Close the queue.add block
      
      // Cache the metadata locally
      setCachedMetadata(nftokenId, uri, result);
      setMetadataCache(prev => ({ ...prev, [nftokenId]: result }));
      
      return result;
    } catch (error) {
      // Only log as error if it's not a content-not-found scenario
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('returned 404') || errorMessage.includes('returned 422') || errorMessage.includes('returned 500')) {
        console.log(`Metadata not found for ${nftokenId}: ${errorMessage}`);
      } else {
        console.error(`Failed to fetch metadata for ${nftokenId}:`, error);
      }
      
      // Mark as failed to avoid retrying
      setFailedMetadata(prev => new Set(prev).add(nftokenId));
      setMetadataCache(prev => ({ ...prev, [nftokenId]: null }));
      return null;
    } finally {
      setLoadingMetadata(prev => ({ ...prev, [nftokenId]: false }));
    }
  }, [metadataCache, failedMetadata]);

  // Group NFTs by taxon
  const groupNFTsByTaxon = useCallback((nfts: Array<{ nftokenId: string; uri?: string; taxon?: number }>): NFTGroup[] => {
    const groups: Record<number, NFTGroup> = {};
    
    nfts.forEach(nft => {
      const taxon = nft.taxon || 0;
      if (!groups[taxon]) {
        groups[taxon] = {
          taxon,
          nfts: [],
          totalCount: 0
        };
      }
      groups[taxon].nfts.push(nft);
      groups[taxon].totalCount++;
      
      // Use metadata from first NFT in group
      if (!groups[taxon].metadata && nft.uri) {
        const metadata = metadataCache[nft.nftokenId];
        if (metadata) {
          groups[taxon].metadata = metadata;
        }
      }
    });
    
    return Object.values(groups).sort((a, b) => a.taxon - b.taxon);
  }, [metadataCache]);

  // Render NFT group (one row per taxon)
  const renderNFTGroup = (group: NFTGroup) => {
    const metadata = group.metadata;
    const firstNFT = group.nfts[0];
    const isLoading = firstNFT ? loadingMetadata[firstNFT.nftokenId] : false;

    return (
      <Card key={`taxon-${group.taxon}`} className="hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-4">
          {/* NFT Image */}
          <div className="flex-shrink-0">
            {metadata?.image ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={metadata.image}
                  alt={metadata.name || `NFT Taxon ${group.taxon}`}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  No Image
                </div>
              </div>
            ) : isLoading ? (
              <div className="w-16 h-16 rounded-lg bg-gray-200 animate-pulse flex items-center justify-center">
                <span className="text-gray-400 text-xs">Loading...</span>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-xs">No Image</span>
              </div>
            )}
          </div>

          {/* NFT Name */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {metadata?.name || `NFT ${group.taxon}`}
            </h3>
          </div>

          {/* Taxon ID */}
          <div className="flex-shrink-0">
            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded">
              Taxon {group.taxon}
            </span>
          </div>

          {/* Quantity */}
          <div className="flex-shrink-0">
            <span className="text-sm font-medium text-gray-900">
              {group.totalCount} NFT{group.totalCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Explorer Link */}
          <div className="flex-shrink-0">
            <a
              href={getBithompLink(firstNFT.nftokenId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="View on Bithomp Explorer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </Card>
    );
  };

  // Set page title
  useEffect(() => {
    document.title = "NFT Gallery - XRPL Stablecoin POC";
  }, []);

  // Load NFTs on mount
  useEffect(() => {
    if (wallets) {
      // Clear expired cache entries
      clearExpiredCache();
      refreshSellerNFTs();
      refreshBuyerNFTs();
    }
  }, [wallets, refreshSellerNFTs, refreshBuyerNFTs]);

  // Update queue status
  useEffect(() => {
    const interval = setInterval(() => {
      setQueueStatus(ipfsQueue.getQueueStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-load metadata when NFTs are loaded
  useEffect(() => {
    const autoLoadMetadata = async () => {
      const allNFTs = [...sellerNFTs, ...buyerNFTs];
      for (const nft of allNFTs) {
        if (nft.uri && 
            metadataCache[nft.nftokenId] === undefined && 
            !loadingMetadata[nft.nftokenId] && 
            !failedMetadata.has(nft.nftokenId)) {
          await fetchMetadata(nft.uri, nft.nftokenId);
        }
      }
    };

    if (sellerNFTs.length > 0 || buyerNFTs.length > 0) {
      autoLoadMetadata();
    }
  }, [sellerNFTs, buyerNFTs, metadataCache, loadingMetadata, failedMetadata, fetchMetadata]);

  const renderNFT = (nft: { nftokenId: string; uri?: string }, role: 'seller' | 'buyer') => {
    const metadata = metadataCache[nft.nftokenId];
    const isLoading = loadingMetadata[nft.nftokenId];
    const hasFailed = failedMetadata.has(nft.nftokenId);

    return (
      <Card key={nft.nftokenId} className="hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {metadata?.name || `NFT ${nft.nftokenId.slice(0, 8)}...`}
            </h3>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-gray-700">Owner:</span>
              <span className="text-sm font-semibold text-gray-900 capitalize bg-blue-50 px-2 py-1 rounded">{role}</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-sm font-medium text-gray-700 flex-shrink-0">ID:</span>
              <div className="flex-1 min-w-0">
                <code className="text-xs bg-gray-900 text-gray-100 px-3 py-2 rounded font-mono break-all block border">
                  {nft.nftokenId}
                </code>
              </div>
              <div className="flex items-center space-x-1">
                <CopyButton text={nft.nftokenId} />
                <a
                  href={getBithompLink(nft.nftokenId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="View on Bithomp Explorer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Image */}
        {metadata?.image && (
          <div className="mb-4 relative w-full h-64 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
            <Image
              src={metadata.image}
              alt={metadata.name || 'NFT Image'}
              fill
              className="object-contain rounded-lg"
              onError={() => {
                // Handle error by hiding the image
                console.error('Failed to load image:', metadata.image);
              }}
            />
          </div>
        )}

        {/* Description */}
        {metadata?.description && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
            <p className="text-sm text-gray-600">{metadata.description}</p>
          </div>
        )}

        {/* Attributes/Traits */}
        {metadata?.attributes && metadata.attributes.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Attributes</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {metadata.attributes.map((attr, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    {attr.trait_type}
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {attr.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* External URL */}
        {metadata?.external_url && (
          <div className="mb-4">
            <a
              href={metadata.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              View External Link →
            </a>
          </div>
        )}

        {/* URI Info */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Metadata URI</h4>
          <div className="flex items-start space-x-2">
            <code className="text-xs bg-gray-900 text-gray-100 px-3 py-2 rounded font-mono flex-1 break-all border">
              {nft.uri || 'No URI'}
            </code>
            {nft.uri && <CopyButton text={nft.uri} />}
          </div>
        </div>

        {/* Load Metadata Button */}
        {!metadata && !isLoading && !hasFailed && nft.uri && (
          <div className="mt-4">
            <Button
              onClick={() => fetchMetadata(nft.uri!, nft.nftokenId)}
              type="primary"
              className="w-full"
            >
              Load Metadata
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Loading metadata...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {!metadata && !isLoading && hasFailed && nft.uri && (
          <div className="mt-4 text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                Metadata not available on IPFS
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                This NFT may not have metadata uploaded to IPFS yet
              </p>
              <Button
                onClick={() => {
                  // Remove from failed list and try again
                  setFailedMetadata(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(nft.nftokenId);
                    return newSet;
                  });
                  setMetadataCache(prev => {
                    const newCache = { ...prev };
                    delete newCache[nft.nftokenId];
                    return newCache;
                  });
                  fetchMetadata(nft.uri!, nft.nftokenId);
                }}
                type="secondary"
                size="sm"
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  if (walletsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
          <Card className="text-center">
            <p className="text-gray-600">Loading wallets...</p>
          </Card>
        </main>
      </div>
    );
  }

  if (!wallets) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">NFT Gallery</h1>
            <p className="text-gray-500 mb-6">Please initialize wallets first in the setup page.</p>
            <Button
              onClick={() => window.location.href = '/setup'}
              type="primary"
            >
              Go to Setup Page
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const currentNFTs = selectedTab === 'seller' ? sellerNFTs : buyerNFTs;
  const refreshFunction = selectedTab === 'seller' ? refreshSellerNFTs : refreshBuyerNFTs;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">NFT Gallery</h1>
          <Button
            onClick={() => window.location.href = '/nft'}
            type="secondary"
          >
            ← Back to NFT Operations
          </Button>
        </div>

        {/* Queue Status Indicator */}
        {(queueStatus.queueLength > 0 || queueStatus.running > 0) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-blue-800">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>
                Loading metadata: {queueStatus.running} active, {queueStatus.queueLength} queued
              </span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setSelectedTab('seller')}
                className={`py-2 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                  selectedTab === 'seller'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Seller NFTs ({sellerNFTs.length})
              </button>
              <button
                onClick={() => setSelectedTab('buyer')}
                className={`py-2 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                  selectedTab === 'buyer'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Buyer NFTs ({buyerNFTs.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedTab === 'seller' ? 'Seller' : 'Buyer'} NFTs
          </h2>
          <Button
            onClick={refreshFunction}
            disabled={listLoading}
            type="secondary"
          >
            {listLoading ? 'Loading...' : 'Refresh NFTs'}
          </Button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setGroupedView(true)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  groupedView 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Grouped by Taxon
              </button>
              <button
                onClick={() => setGroupedView(false)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  !groupedView 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Individual NFTs
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {currentNFTs.length} NFT{currentNFTs.length !== 1 ? 's' : ''} total
          </div>
        </div>

        {/* NFT Display */}
        {currentNFTs.length > 0 ? (
          groupedView ? (
            <div className="space-y-4">
              {groupNFTsByTaxon(currentNFTs).map((group) => renderNFTGroup(group))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentNFTs.map((nft) => renderNFT(nft, selectedTab))}
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No NFTs found</h3>
            <p className="text-gray-500">
              {selectedTab === 'seller' 
                ? 'The seller has not minted any NFTs yet.' 
                : 'The buyer has not acquired any NFTs yet.'
              }
            </p>
          </div>
        )}
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
