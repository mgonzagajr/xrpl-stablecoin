import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
import { loadData } from '@/lib/vercel-storage';
import { getWebSocketUrl } from '@/lib/network-config';
import { ensureFunded } from '@/lib/xrpl-helpers';
import { addNFTLogEntry, findNFTLogEntry } from '@/lib/nft-log';
import { WalletData } from '@/types/wallet';

interface MintRequest {
  uri: string;
  transferable?: boolean;
  taxon?: number;
  idempotencyKey?: string;
}


export async function POST(request: NextRequest) {
  try {
    const body: MintRequest = await request.json();
    const { uri, transferable = true, taxon = 0, idempotencyKey } = body;

    // Validate inputs
    if (!uri || typeof uri !== 'string' || uri.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_URI' },
        { status: 400 }
      );
    }

    if (taxon !== undefined && (typeof taxon !== 'number' || taxon < 0 || taxon > 4294967295)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_TAXON', details: 'Taxon must be a number between 0 and 4294967295' },
        { status: 400 }
      );
    }

    // Validate URI format
    if (!uri.startsWith('ipfs://') && !uri.startsWith('https://')) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_URI_FORMAT' },
        { status: 400 }
      );
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = findNFTLogEntry('mint', idempotencyKey);
      if (existing) {
        return NextResponse.json({
          ok: true,
          data: {
            nftokenId: existing.nftokenId!,
            txHash: existing.txHash!,
            uri: existing.uri!,
            transferable: existing.transferable!,
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
    const sellerWalletData = wallets.wallets.find(w => w.role === 'seller');
    if (!sellerWalletData) {
      return NextResponse.json(
        { ok: false, error: 'SELLER_WALLET_NOT_FOUND' },
        { status: 400 }
      );
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

      // Prepare NFTokenMint transaction
      const mintTransaction = {
        TransactionType: 'NFTokenMint' as const,
        Account: sellerWalletData.address,
        URI: Buffer.from(uri, 'utf8').toString('hex'),
        NFTokenTaxon: taxon, // Collection identifier
        Flags: transferable ? 8 : 0, // tfTransferable = 8
        SourceTag: wallets.sourceTag,
      };

      console.log('Minting NFT with transaction:', JSON.stringify(mintTransaction, null, 2));

      // Submit transaction - use submitAndWait for Mainnet reliability
      let response;
      let txHash;
      
      if (process.env.XRPL_NETWORK === 'MAINNET') {
        // Use submitAndWait for Mainnet - more reliable
        const prepared = await client.autofill(mintTransaction);
        const signed = sellerWallet.sign(prepared);
        response = await client.submitAndWait(signed.tx_blob);
        txHash = response.result.hash;
        console.log('Mainnet transaction submitted and validated:', txHash);
      } else {
        // Use regular submit for Testnet
        response = await client.submit(mintTransaction, { wallet: sellerWallet });
        console.log('Transaction submission response:', JSON.stringify(response.result, null, 2));
        
        if (response.result.engine_result !== 'tesSUCCESS') {
          return NextResponse.json(
            { ok: false, error: 'XRPL_REQUEST_FAILED', details: response.result.engine_result_message },
            { status: 400 }
          );
        }
        txHash = response.result.tx_json.hash;
      }
      
      // Extract NFTokenID from transaction metadata
      let nftokenId: string | undefined;
      
      if (process.env.XRPL_NETWORK === 'MAINNET') {
        // For Mainnet, use the response from submitAndWait directly
        const meta = (response.result as { meta?: { nftoken_id?: string; AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }> } }).meta;
        nftokenId = meta?.nftoken_id || meta?.AffectedNodes?.find((node: { CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }) => 
          node.CreatedNode?.LedgerEntryType === 'NFToken'
        )?.CreatedNode?.NewFields?.NFTokenID;
      } else {
        // For Testnet, wait for validation
        let attempts = 0;
        let txResult;
        let lastError;
        
        do {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            txResult = await client.request({
              command: 'tx',
              transaction: txHash,
            });
            attempts++;
            console.log(`Attempt ${attempts}: validated = ${txResult.result.validated}`);
        } catch (error) {
          lastError = error;
          attempts++;
          console.log(`Attempt ${attempts}: Error fetching transaction - ${error instanceof Error ? error.message : 'Unknown error'}`);
          txResult = { result: { validated: false } };
        }
        } while (!txResult.result.validated && attempts < 10);

        if (!txResult.result.validated) {
          console.error('Transaction validation timeout:', lastError instanceof Error ? lastError.message : 'Unknown error');
          return NextResponse.json(
            { 
              ok: false, 
              error: 'TRANSACTION_NOT_VALIDATED', 
              details: `Transaction was not validated within timeout. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown'}`,
              txHash
            },
            { status: 400 }
          );
        }

        const meta = txResult.result.meta as { nftoken_id?: string; AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }> };
        nftokenId = meta?.nftoken_id || meta?.AffectedNodes?.find((node: { CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }) => 
          node.CreatedNode?.LedgerEntryType === 'NFToken'
        )?.CreatedNode?.NewFields?.NFTokenID;
      }

      if (!nftokenId) {
        console.error('NFT_MINT_FAILED: Could not extract NFTokenID from transaction metadata');
        console.error('Transaction response:', JSON.stringify(response.result, null, 2));
        return NextResponse.json(
          { 
            ok: false, 
            error: 'NFT_MINT_FAILED', 
            details: 'Could not extract NFTokenID from transaction metadata',
            txHash // Return the transaction hash so user can check manually
          },
          { status: 400 }
        );
      }

      // Log the mint operation
      if (idempotencyKey) {
        addNFTLogEntry({
          kind: 'mint',
          key: idempotencyKey,
          nftokenId,
          txHash,
          uri,
          transferable,
        });
      }

      return NextResponse.json({
        ok: true,
        data: {
          nftokenId,
          txHash,
          uri,
          transferable,
        },
      });

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('NFT mint error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
