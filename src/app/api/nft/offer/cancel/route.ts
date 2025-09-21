import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
// Removed fs import
// Removed path import
import { ensureFunded } from '@/lib/xrpl-helpers';
import { addNFTLogEntry, findNFTLogEntry } from '@/lib/nft-log';
import { loadData } from '@/lib/vercel-storage';
import { getWebSocketUrl } from '@/lib/network-config';
import { WalletData } from '@/types/wallet';

interface CancelOfferRequest {
  offerIndex: string;
  idempotencyKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CancelOfferRequest = await request.json();
    const { offerIndex, idempotencyKey } = body;

    // Validate input
    if (!offerIndex) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_OFFER_INDEX', details: 'Offer Index cannot be empty' },
        { status: 400 }
      );
    }

    // Load wallets from storage (Vercel Blob in production, local file in development)
    const wallets = await loadData<WalletData>('wallets.json');
    if (!wallets) {
      return NextResponse.json(
        { ok: false, error: 'WALLETS_NOT_FOUND' },
        { status: 400 }
      );
    }
    const sellerWalletData = wallets.wallets.find(w => w.role === 'seller');
    
    if (!sellerWalletData) {
      return NextResponse.json(
        { ok: false, error: 'SELLER_WALLET_NOT_FOUND' },
        { status: 400 }
      );
    }

    // Check for idempotency
    if (idempotencyKey) {
      const existingEntry = findNFTLogEntry('offer_cancel', idempotencyKey);
      if (existingEntry) {
        console.log(`Idempotent offer cancel request for key ${idempotencyKey}. Returning previous result.`);
        return NextResponse.json({
          ok: true,
          data: {
            txHash: existingEntry.txHash,
            offerIndex: existingEntry.offerIndex!,
          },
        });
      }
    }

    // Connect to XRPL
    const wsUrl = getWebSocketUrl();
    const client = new Client(wsUrl);
    await client.connect();

    try {
      // Ensure seller is funded
      const sellerWallet = Wallet.fromSeed(sellerWalletData.seed);
      const fundingResult = await ensureFunded(client, sellerWallet, Number(process.env.XRPL_MIN_XRP) || 20);
      if (fundingResult.status === 'error') {
        return NextResponse.json(
          { ok: false, error: 'INSUFFICIENT_XRP_RESERVE', details: fundingResult.errorCode },
          { status: 400 }
        );
      }

      // Prepare NFTokenCancelOffer transaction
      const cancelTransaction = {
        TransactionType: 'NFTokenCancelOffer' as const,
        Account: sellerWalletData.address,
        NFTokenOffers: [offerIndex],
        SourceTag: wallets.sourceTag,
      };

      console.log('Canceling NFT offer with transaction:', JSON.stringify(cancelTransaction, null, 2));

      // Submit transaction
      const response = await client.submit(cancelTransaction, { wallet: sellerWallet });
      
      console.log('Offer cancellation response:', JSON.stringify(response.result, null, 2));
      
      if (response.result.engine_result !== 'tesSUCCESS') {
        return NextResponse.json(
          { ok: false, error: 'XRPL_REQUEST_FAILED', details: response.result.engine_result_message },
          { status: 400 }
        );
      }

      const txHash = response.result.tx_json.hash;

      // Log the offer cancellation
      if (idempotencyKey) {
        addNFTLogEntry({
          kind: 'offer_cancel',
          key: idempotencyKey,
          txHash,
          offerIndex,
        });
      }

      return NextResponse.json({
        ok: true,
        data: {
          txHash,
          offerIndex,
        },
      });

    } catch (error: unknown) {
      console.error('Error canceling NFT offer:', error);
      return NextResponse.json(
        { ok: false, error: 'XRPL_REQUEST_FAILED', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    } finally {
      await client.disconnect();
    }
  } catch (error: unknown) {
    console.error('Error in NFT offer cancel API:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
