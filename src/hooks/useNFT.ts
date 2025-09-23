import { useState, useCallback } from 'react';

export interface NFT {
  nftokenId: string;
  uri?: string;
  taxon?: number;
}

export interface NFTOffer {
  offerIndex: string;
  nftokenId: string;
  amount: string;
}

export interface MintRequest {
  uri: string;
  transferable?: boolean;
  taxon?: number;
  idempotencyKey?: string;
}

export interface CreateOfferRequest {
  nftokenId: string;
  amount: string;
  idempotencyKey?: string;
}

export interface AcceptOfferRequest {
  offerIndex: string;
  idempotencyKey?: string;
}

export interface CancelOfferRequest {
  offerIndex: string;
  idempotencyKey?: string;
}

export interface BurnRequest {
  nftokenId: string;
  role?: 'seller' | 'buyer';
  idempotencyKey?: string;
}

export interface BatchMintRequest {
  uri: string;
  count: number;
  transferable?: boolean;
  taxon?: number;
  batchId?: string;
}

export interface BatchMintResponse {
  success: boolean;
  totalProcessed: number;
  totalRequested: number;
  nftokenIds: string[];
  txHashes: string[];
  errors: Array<{
    nftIndex: number;
    error: string;
    attempts: number;
  }>;
}

export interface MintResponse {
  nftokenId: string;
  txHash: string;
  uri: string;
  transferable: boolean;
}

export interface CreateOfferResponse {
  offerIndex: string;
  nftokenId: string;
  amount: string;
}

export interface AcceptOfferResponse {
  txHash: string;
  offerIndex: string;
  nftokenId?: string;
  price?: string;
}

export interface CancelOfferResponse {
  txHash: string;
  offerIndex: string;
}

export interface BurnResponse {
  nftokenId: string;
  txHash: string;
}

export function useNFT() {
  const [mintLoading, setMintLoading] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintData, setMintData] = useState<MintResponse | null>(null);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [sellerNFTs, setSellerNFTs] = useState<NFT[]>([]);
  const [buyerNFTs, setBuyerNFTs] = useState<NFT[]>([]);

  const [createOfferLoading, setCreateOfferLoading] = useState(false);
  const [createOfferError, setCreateOfferError] = useState<string | null>(null);
  const [createOfferData, setCreateOfferData] = useState<CreateOfferResponse | null>(null);

  const [listOffersLoading, setListOffersLoading] = useState(false);
  const [listOffersError, setListOffersError] = useState<string | null>(null);
  const [offers, setOffers] = useState<NFTOffer[]>([]);

  const [acceptOfferLoading, setAcceptOfferLoading] = useState(false);
  const [acceptOfferError, setAcceptOfferError] = useState<string | null>(null);
  const [acceptOfferData, setAcceptOfferData] = useState<AcceptOfferResponse | null>(null);

  const [cancelOfferLoading, setCancelOfferLoading] = useState(false);
  const [cancelOfferError, setCancelOfferError] = useState<string | null>(null);
  const [cancelOfferData, setCancelOfferData] = useState<CancelOfferResponse | null>(null);

  const [burnLoading, setBurnLoading] = useState(false);
  const [burnError, setBurnError] = useState<string | null>(null);
  const [burnData, setBurnData] = useState<BurnResponse | null>(null);

  const [batchMintLoading, setBatchMintLoading] = useState(false);
  const [batchMintError, setBatchMintError] = useState<string | null>(null);
  const [batchMintData, setBatchMintData] = useState<BatchMintResponse | null>(null);

  const mint = async (request: MintRequest) => {
    setMintLoading(true);
    setMintError(null);
    setMintData(null);

    try {
      const response = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.ok) {
        setMintData(result.data);
        return { success: true, data: result.data };
      } else {
        setMintError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMintError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setMintLoading(false);
    }
  };

  const listNFTs = useCallback(async (role: 'seller' | 'buyer') => {
    setListLoading(true);
    setListError(null);

    try {
      const response = await fetch(`/api/nft/list?role=${role}`);
      const result = await response.json();

      if (result.ok) {
        if (role === 'seller') {
          setSellerNFTs(result.data.nfts);
        } else {
          setBuyerNFTs(result.data.nfts);
        }
        return { success: true, data: result.data };
      } else {
        setListError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setListError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setListLoading(false);
    }
  }, []);

  const createOffer = async (request: CreateOfferRequest) => {
    setCreateOfferLoading(true);
    setCreateOfferError(null);
    setCreateOfferData(null);

    try {
      const response = await fetch('/api/nft/offer/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.ok) {
        setCreateOfferData(result.data);
        return { success: true, data: result.data };
      } else {
        setCreateOfferError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setCreateOfferError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setCreateOfferLoading(false);
    }
  };

  const listOffers = useCallback(async (seller?: boolean, buyer?: boolean, nftokenId?: string) => {
    setListOffersLoading(true);
    setListOffersError(null);

    try {
      const params = new URLSearchParams();
      if (seller) params.append('seller', '1');
      if (buyer) params.append('buyer', '1');
      if (nftokenId) params.append('nftokenId', nftokenId);

      const response = await fetch(`/api/nft/offer/list?${params.toString()}`);
      const result = await response.json();

      if (result.ok) {
        setOffers(result.data.offers);
        return { success: true, data: result.data };
      } else {
        setListOffersError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setListOffersError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setListOffersLoading(false);
    }
  }, []);

  const acceptOffer = async (request: AcceptOfferRequest) => {
    setAcceptOfferLoading(true);
    setAcceptOfferError(null);
    setAcceptOfferData(null);

    try {
      const response = await fetch('/api/nft/offer/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.ok) {
        setAcceptOfferData(result.data);
        return { success: true, data: result.data };
      } else {
        setAcceptOfferError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAcceptOfferError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setAcceptOfferLoading(false);
    }
  };

  const cancelOffer = async (request: CancelOfferRequest) => {
    setCancelOfferLoading(true);
    setCancelOfferError(null);
    setCancelOfferData(null);

    try {
      const response = await fetch('/api/nft/offer/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.ok) {
        setCancelOfferData(result.data);
        return { success: true, data: result.data };
      } else {
        setCancelOfferError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setCancelOfferError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setCancelOfferLoading(false);
    }
  };

  const burn = async (request: BurnRequest) => {
    setBurnLoading(true);
    setBurnError(null);
    setBurnData(null);

    try {
      const response = await fetch('/api/nft/burn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.ok) {
        setBurnData(result.data);
        return { success: true, data: result.data };
      } else {
        setBurnError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setBurnError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setBurnLoading(false);
    }
  };

  const mintBatch = async (
    request: BatchMintRequest,
    onProgress?: (update: {
      type: string;
      message?: string;
      nftIndex?: number;
      total?: number;
      nftokenId?: string;
      txHash?: string;
      error?: string;
      attempts?: number;
    }) => void
  ) => {
    setBatchMintLoading(true);
    setBatchMintError(null);
    setBatchMintData(null);

    try {
      const response = await fetch('/api/nft/mint-batch-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: BatchMintResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Call progress callback if provided
              if (onProgress) {
                onProgress(data);
              }

              // Handle different update types
              if (data.type === 'success') {
                // Update our local state with successful NFT
                setBatchMintData(prev => {
                  if (!prev) {
                    return {
                      success: false,
                      totalProcessed: 1,
                      totalRequested: request.count,
                      nftokenIds: [data.nftokenId],
                      txHashes: [data.txHash],
                      errors: []
                    };
                  }
                  return {
                    ...prev,
                    totalProcessed: prev.totalProcessed + 1,
                    nftokenIds: [...prev.nftokenIds, data.nftokenId],
                    txHashes: [...prev.txHashes, data.txHash]
                  };
                });
              } else if (data.type === 'error') {
                // Update our local state with error
                setBatchMintData(prev => {
                  if (!prev) {
                    return {
                      success: false,
                      totalProcessed: 0,
                      totalRequested: request.count,
                      nftokenIds: [],
                      txHashes: [],
                      errors: [{
                        nftIndex: data.nftIndex || 0,
                        error: data.error || data.message || 'Unknown error',
                        attempts: data.attempts || 1
                      }]
                    };
                  }
                  return {
                    ...prev,
                    errors: [...prev.errors, {
                      nftIndex: data.nftIndex || 0,
                      error: data.error || data.message || 'Unknown error',
                      attempts: data.attempts || 1
                    }]
                  };
                });
              } else if (data.type === 'complete') {
                // Final result
                setBatchMintData(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    success: prev.totalProcessed === prev.totalRequested
                  };
                });
                finalResult = {
                  success: true,
                  totalProcessed: data.nftIndex || 0,
                  totalRequested: data.total || request.count,
                  nftokenIds: [],
                  txHashes: [],
                  errors: []
                };
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      return { success: true, data: finalResult };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setBatchMintError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setBatchMintLoading(false);
    }
  };

  const refreshSellerNFTs = useCallback(() => listNFTs('seller'), [listNFTs]);
  const refreshBuyerNFTs = useCallback(() => listNFTs('buyer'), [listNFTs]);
  const refreshOffers = useCallback(() => listOffers(true, false), [listOffers]);

  return {
    // Mint
    mintLoading,
    mintError,
    mintData,
    mint,

    // List NFTs
    listLoading,
    listError,
    sellerNFTs,
    buyerNFTs,
    listNFTs,
    refreshSellerNFTs,
    refreshBuyerNFTs,

    // Create Offer
    createOfferLoading,
    createOfferError,
    createOfferData,
    createOffer,

    // List Offers
    listOffersLoading,
    listOffersError,
    offers,
    listOffers,
    refreshOffers,

    // Accept Offer
    acceptOfferLoading,
    acceptOfferError,
    acceptOfferData,
    acceptOffer,

    // Cancel Offer
    cancelOfferLoading,
    cancelOfferError,
    cancelOfferData,
    cancelOffer,

    // Burn
    burnLoading,
    burnError,
    burnData,
    burn,

    // Batch Mint
    batchMintLoading,
    batchMintError,
    batchMintData,
    mintBatch,
  };
}
