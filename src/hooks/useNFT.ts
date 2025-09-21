import { useState, useCallback } from 'react';

export interface NFT {
  nftokenId: string;
  uri?: string;
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
  };
}
