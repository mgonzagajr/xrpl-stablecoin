import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
import fs from 'fs';
import path from 'path';
import { ensureFunded } from '@/lib/xrpl-helpers';
import { ensureIssuerAuthorization } from '@/lib/issuer-auth';
import { addNFTLogEntry, findNFTLogEntry } from '@/lib/nft-log';
import { WalletData } from '@/types/wallet';

interface CreateOfferRequest {
  nftokenId: string;
  amount: string;
  idempotencyKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateOfferRequest = await request.json();
    const { nftokenId, amount, idempotencyKey } = body;

    // Validate inputs
    if (!nftokenId || typeof nftokenId !== 'string' || nftokenId.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_NFTOKEN_ID' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'string' || amount.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }

    // Validate amount is positive decimal
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = findNFTLogEntry('offer_create', idempotencyKey);
      if (existing) {
        return NextResponse.json({
          ok: true,
          data: {
            offerIndex: existing.offerIndex!,
            nftokenId: existing.nftokenId!,
            amount: existing.amount!,
          },
        });
      }
    }

    // Load wallets
    const walletsPath = path.join(process.cwd(), 'data', 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
      return NextResponse.json(
        { ok: false, error: 'WALLETS_NOT_FOUND' },
        { status: 400 }
      );
    }

    const wallets: WalletData = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
    const sellerWalletData = wallets.wallets.find(w => w.role === 'seller');
    const issuerWalletData = wallets.wallets.find(w => w.role === 'issuer');
    
    if (!sellerWalletData || !issuerWalletData) {
      return NextResponse.json(
        { ok: false, error: 'WALLET_NOT_FOUND' },
        { status: 400 }
      );
    }

    // Connect to XRPL
    const client = new Client(process.env.XRPL_WS_URL!);
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

      // Check if seller has trust line to issuer for SBR
      const accountLines = await client.request({
        command: 'account_lines',
        account: sellerWalletData.address,
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
          sellerWalletData.address,
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

      // Prepare NFTokenCreateOffer transaction
      const offerTransaction = {
        TransactionType: 'NFTokenCreateOffer' as const,
        Account: sellerWalletData.address,
        NFTokenID: nftokenId,
        Amount: {
          currency: process.env.XRPL_CURRENCY_CODE!,
          issuer: issuerWalletData.address,
          value: amount,
        },
        Flags: 1, // tfSellNFToken
        SourceTag: wallets.sourceTag,
      };

      console.log('Creating NFT offer with transaction:', JSON.stringify(offerTransaction, null, 2));

      // Submit transaction
      const response = await client.submit(offerTransaction, { wallet: sellerWallet });
      
      console.log('Offer creation response:', JSON.stringify(response.result, null, 2));
      
      if (response.result.engine_result !== 'tesSUCCESS') {
        return NextResponse.json(
          { ok: false, error: 'XRPL_REQUEST_FAILED', details: response.result.engine_result_message },
          { status: 400 }
        );
      }

      // Get offer index from transaction metadata (wait for validation)
      const txHash = response.result.tx_json.hash;
      
      // Wait for transaction to be validated
      let attempts = 0;
      let txResult;
      
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        txResult = await client.request({
          command: 'tx',
          transaction: txHash,
        });
        attempts++;
        console.log(`Offer create attempt ${attempts}: validated = ${txResult.result.validated}`);
      } while (!txResult.result.validated && attempts < 10);

      if (!txResult.result.validated) {
        return NextResponse.json(
          { ok: false, error: 'TRANSACTION_NOT_VALIDATED', details: 'Transaction was not validated within timeout' },
          { status: 400 }
        );
      }

      const meta = txResult.result.meta as { offer_id?: string; AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType?: string; LedgerIndex?: string } }> };
      const offerIndex = meta?.offer_id || meta?.AffectedNodes?.find((node: { CreatedNode?: { LedgerEntryType?: string; LedgerIndex?: string } }) => 
        node.CreatedNode?.LedgerEntryType === 'NFTokenOffer'
      )?.CreatedNode?.LedgerIndex;

      if (!offerIndex) {
        console.error('OFFER_CREATE_FAILED: Could not extract offer index from transaction metadata');
        console.error('Transaction metadata:', JSON.stringify(meta, null, 2));
        console.error('Transaction result:', JSON.stringify(txResult.result, null, 2));
        return NextResponse.json(
          { ok: false, error: 'OFFER_CREATE_FAILED', details: 'Could not extract offer index from transaction metadata' },
          { status: 400 }
        );
      }

      // Log the offer creation
      if (idempotencyKey) {
        addNFTLogEntry({
          kind: 'offer_create',
          key: idempotencyKey,
          nftokenId,
          offerIndex,
          amount,
        });
      }

      return NextResponse.json({
        ok: true,
        data: {
          offerIndex,
          nftokenId,
          amount,
        },
      });

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('NFT offer create error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
