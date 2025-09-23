import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
import { loadData } from '@/lib/vercel-storage';
import { getWebSocketUrl } from '@/lib/network-config';
import { ensureFunded } from '@/lib/xrpl-helpers';
import { addNFTLogEntry, findNFTLogEntry } from '@/lib/nft-log';
import { WalletData } from '@/types/wallet';

interface BatchMintRequest {
  uri: string;
  count: number;
  transferable?: boolean;
  taxon?: number;
  batchId?: string;
}

interface BatchMintResponse {
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

export async function POST(request: NextRequest) {
  try {
    const body: BatchMintRequest = await request.json();
    const { uri, count, transferable = true, taxon = 0, batchId } = body;

    // Validate inputs
    if (!uri || typeof uri !== 'string' || uri.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_URI' },
        { status: 400 }
      );
    }

    if (!count || typeof count !== 'number' || count < 1 || count > 200) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_COUNT', details: 'Count must be between 1 and 200' },
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

    // Load wallets from storage
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

      const results: BatchMintResponse = {
        success: false,
        totalProcessed: 0,
        totalRequested: count,
        nftokenIds: [],
        txHashes: [],
        errors: []
      };

      // Process each NFT sequentially
      for (let i = 1; i <= count; i++) {
        let nftokenId: string | undefined;
        let txHash: string | undefined;
        let attempts = 0;
        let lastError: string | undefined;
        let success = false;

        // Try up to 3 times for each NFT
        while (attempts < 3 && !success) {
          attempts++;
          
          try {
            // Check idempotency for this specific NFT
            const nftIdempotencyKey = batchId ? `${batchId}-${i}` : undefined;
            if (nftIdempotencyKey) {
              const existing = findNFTLogEntry('mint', nftIdempotencyKey);
              if (existing) {
                nftokenId = existing.nftokenId!;
                txHash = existing.txHash!;
                success = true;
                break;
              }
            }

            // Prepare NFTokenMint transaction
            const mintTransaction = {
              TransactionType: 'NFTokenMint' as const,
              Account: sellerWalletData.address,
              URI: Buffer.from(uri, 'utf8').toString('hex'),
              NFTokenTaxon: taxon,
              Flags: transferable ? 8 : 0,
              SourceTag: wallets.sourceTag,
            };

            console.log(`Minting NFT ${i}/${count} (attempt ${attempts}):`, JSON.stringify(mintTransaction, null, 2));

            // Submit transaction
            let response;
            
            if (process.env.XRPL_NETWORK === 'MAINNET') {
              // Use submitAndWait for Mainnet
              const prepared = await client.autofill(mintTransaction);
              const signed = sellerWallet.sign(prepared);
              response = await client.submitAndWait(signed.tx_blob);
              txHash = response.result.hash;
              console.log(`Mainnet NFT ${i} transaction submitted and validated:`, txHash);
            } else {
              // Use regular submit for Testnet
              response = await client.submit(mintTransaction, { wallet: sellerWallet });
              console.log(`Testnet NFT ${i} transaction submission response:`, JSON.stringify(response.result, null, 2));
              
              if (response.result.engine_result !== 'tesSUCCESS') {
                lastError = `XRPL request failed: ${response.result.engine_result_message}`;
                continue;
              }
              txHash = response.result.tx_json.hash;
            }
            
            // Extract NFTokenID from transaction metadata
            if (process.env.XRPL_NETWORK === 'MAINNET') {
              const meta = (response.result as { meta?: { nftoken_id?: string; AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }> } }).meta;
              nftokenId = meta?.nftoken_id || meta?.AffectedNodes?.find((node: { CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }) => 
                node.CreatedNode?.LedgerEntryType === 'NFToken'
              )?.CreatedNode?.NewFields?.NFTokenID;
            } else {
              // For Testnet, wait for validation
              let validationAttempts = 0;
              let txResult;
              
              do {
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                  txResult = await client.request({
                    command: 'tx',
                    transaction: txHash,
                  });
                  validationAttempts++;
                  console.log(`NFT ${i} validation attempt ${validationAttempts}: validated = ${txResult.result.validated}`);
                } catch (error) {
                  validationAttempts++;
                  console.log(`NFT ${i} validation attempt ${validationAttempts}: Error fetching transaction - ${error instanceof Error ? error.message : 'Unknown error'}`);
                  txResult = { result: { validated: false } };
                }
              } while (!txResult.result.validated && validationAttempts < 30); // 30 second timeout

              if (!txResult.result.validated) {
                lastError = `Transaction validation timeout after 30 seconds`;
                continue;
              }

              const meta = txResult.result.meta as { nftoken_id?: string; AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }> };
              nftokenId = meta?.nftoken_id || meta?.AffectedNodes?.find((node: { CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }) => 
                node.CreatedNode?.LedgerEntryType === 'NFToken'
              )?.CreatedNode?.NewFields?.NFTokenID;
            }

            if (!nftokenId) {
              lastError = 'Could not extract NFTokenID from transaction metadata';
              continue;
            }

            // Log the mint operation
            if (nftIdempotencyKey) {
              addNFTLogEntry({
                kind: 'mint',
                key: nftIdempotencyKey,
                nftokenId,
                txHash,
                uri,
                transferable,
              });
            }

            success = true;
            console.log(`NFT ${i}/${count} minted successfully:`, nftokenId);

          } catch (error) {
            lastError = error instanceof Error ? error.message : 'Unknown error';
            console.error(`NFT ${i} attempt ${attempts} failed:`, lastError);
            
            // If it's a timeout error, wait 30 seconds before retry
            if (lastError.toLowerCase().includes('timeout') && attempts < 3) {
              console.log(`NFT ${i} timeout detected, waiting 30 seconds before retry...`);
              await new Promise(resolve => setTimeout(resolve, 30000));
            }
          }
        }

        if (success && nftokenId && txHash) {
          results.nftokenIds.push(nftokenId);
          results.txHashes.push(txHash);
          results.totalProcessed++;
        } else {
          results.errors.push({
            nftIndex: i,
            error: lastError || 'Unknown error',
            attempts
          });
          
          // If we failed 3 times, stop the entire process
          console.error(`NFT ${i} failed after 3 attempts, stopping batch process`);
          break;
        }
      }

      results.success = results.totalProcessed === count;

      return NextResponse.json({
        ok: true,
        data: results,
      });

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('Batch NFT mint error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
