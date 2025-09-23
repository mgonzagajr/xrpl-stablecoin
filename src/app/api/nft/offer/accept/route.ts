import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
import { loadData } from '@/lib/vercel-storage';
import { getWebSocketUrl } from '@/lib/network-config';
import { ensureFunded } from '@/lib/xrpl-helpers';
import { ensureIssuerAuthorization } from '@/lib/issuer-auth';
import { addNFTLogEntry, findNFTLogEntry } from '@/lib/nft-log';
import { WalletData } from '@/types/wallet';

interface AcceptOfferRequest {
  offerIndex: string;
  idempotencyKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AcceptOfferRequest = await request.json();
    const { offerIndex, idempotencyKey } = body;

    // Validate inputs
    if (!offerIndex || typeof offerIndex !== 'string' || offerIndex.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_OFFER_INDEX' },
        { status: 400 }
      );
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = findNFTLogEntry('offer_accept', idempotencyKey);
      if (existing) {
        return NextResponse.json({
          ok: true,
          data: {
            txHash: existing.txHash!,
            offerIndex: existing.offerIndex!,
            nftokenId: existing.nftokenId,
            price: existing.amount,
          },
        });
      }
    }

    // Load wallets from storage (Vercel Blob in production, local file in development)
    const wallets = await loadData<WalletData>('wallets.json');
    if (!wallets) {
      return NextResponse.json(
        { ok: false, error: 'WALLETS_NOT_FOUND' },
        { status: 400 }
      );
    }
    const buyerWalletData = wallets.wallets.find(w => w.role === 'buyer');
    const issuerWalletData = wallets.wallets.find(w => w.role === 'issuer');
    
    if (!buyerWalletData || !issuerWalletData) {
      return NextResponse.json(
        { ok: false, error: 'WALLET_NOT_FOUND' },
        { status: 400 }
      );
    }

    // Connect to XRPL
    const wsUrl = getWebSocketUrl();
    const client = new Client(wsUrl);
    await client.connect();

    try {
      // Ensure buyer is funded
      const buyerWallet = Wallet.fromSeed(buyerWalletData.seed);
      const fundingResult = await ensureFunded(client, buyerWallet, Number(process.env.XRPL_MIN_XRP) || 20);
      if (fundingResult.status === 'error') {
        return NextResponse.json(
          { ok: false, error: 'INSUFFICIENT_XRP_RESERVE', details: fundingResult.errorCode },
          { status: 400 }
        );
      }

      // Check if buyer has trust line to issuer for SBR
      const accountLines = await client.request({
        command: 'account_lines',
        account: buyerWalletData.address,
        peer: issuerWalletData.address,
      });

      const trustLine = accountLines.result.lines.find((line: { currency: string; account: string }) => 
        line.currency === process.env.XRPL_CURRENCY_CODE && line.account === issuerWalletData.address
      );

      if (!trustLine) {
        return NextResponse.json(
          { ok: false, error: 'MISSING_TRUSTLINE' },
          { status: 400 }
        );
      }

      // If require auth is enabled, ensure authorization
      if (process.env.XRPL_REQUIRE_AUTH === 'true') {
        const issuerWallet = Wallet.fromSeed(issuerWalletData.seed);
        const authResult = await ensureIssuerAuthorization(
          client,
          issuerWallet,
          buyerWalletData.address,
          process.env.XRPL_CURRENCY_CODE!,
          wallets.sourceTag
        );
        if (authResult.status === 'error') {
          return NextResponse.json(
            { ok: false, error: 'NOT_AUTHORIZED' },
            { status: 400 }
          );
        }
      }

      // For now, skip detailed offer validation and proceed with acceptance
      // In a production system, you would validate the offer exists and check balances

      // Prepare NFTokenAcceptOffer transaction
      const acceptTransaction = {
        TransactionType: 'NFTokenAcceptOffer' as const,
        Account: buyerWalletData.address,
        NFTokenSellOffer: offerIndex,
        SourceTag: wallets.sourceTag,
      };

      // Submit transaction - use submitAndWait for Mainnet reliability
      let response;
      let txHash;
      
      if (process.env.XRPL_NETWORK === 'MAINNET') {
        // Use submitAndWait for Mainnet - more reliable
        const prepared = await client.autofill(acceptTransaction);
        const signed = buyerWallet.sign(prepared);
        response = await client.submitAndWait(signed.tx_blob);
        
        // Check if transaction was successful
        if (typeof response.result.meta === 'object' && response.result.meta && 'TransactionResult' in response.result.meta && response.result.meta.TransactionResult !== 'tesSUCCESS') {
          return NextResponse.json(
            { ok: false, error: 'XRPL_REQUEST_FAILED', details: response.result.meta.TransactionResult },
            { status: 400 }
          );
        }
        
        txHash = response.result.hash;
        console.log('Mainnet accept transaction submitted and validated:', txHash);
      } else {
        // Use regular submit for Testnet
        response = await client.submit(acceptTransaction, { wallet: buyerWallet });
        
        if (response.result.engine_result !== 'tesSUCCESS') {
          return NextResponse.json(
            { ok: false, error: 'XRPL_REQUEST_FAILED', details: response.result.engine_result_message },
            { status: 400 }
          );
        }
        txHash = response.result.tx_json.hash;
      }

      // Log the offer acceptance
      if (idempotencyKey) {
        addNFTLogEntry({
          kind: 'offer_accept',
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

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('NFT offer accept error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
