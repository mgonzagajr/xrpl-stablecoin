import { NextRequest } from 'next/server';
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

interface ProgressUpdate {
  type: 'progress' | 'success' | 'error' | 'complete';
  nftIndex?: number;
  total?: number;
  nftokenId?: string;
  txHash?: string;
  error?: string;
  attempts?: number;
  message?: string;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (update: ProgressUpdate) => {
        const data = `data: ${JSON.stringify(update)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        const body: BatchMintRequest = await request.json();
        const { uri, count, transferable = true, taxon = 0, batchId } = body;

        // Validate inputs
        if (!uri || typeof uri !== 'string' || uri.trim() === '') {
          sendUpdate({ type: 'error', message: 'INVALID_URI' });
          controller.close();
          return;
        }

        if (!count || typeof count !== 'number' || count < 1 || count > 200) {
          sendUpdate({ type: 'error', message: 'INVALID_COUNT' });
          controller.close();
          return;
        }

        if (taxon !== undefined && (typeof taxon !== 'number' || taxon < 0 || taxon > 4294967295)) {
          sendUpdate({ type: 'error', message: 'INVALID_TAXON' });
          controller.close();
          return;
        }

        if (!uri.startsWith('ipfs://') && !uri.startsWith('https://')) {
          sendUpdate({ type: 'error', message: 'INVALID_URI_FORMAT' });
          controller.close();
          return;
        }

        // Load wallets from storage
        const wallets = await loadData<WalletData>('wallets.json');
        if (!wallets) {
          sendUpdate({ type: 'error', message: 'WALLETS_NOT_FOUND' });
          controller.close();
          return;
        }
        const sellerWalletData = wallets.wallets.find(w => w.role === 'seller');
        if (!sellerWalletData) {
          sendUpdate({ type: 'error', message: 'SELLER_WALLET_NOT_FOUND' });
          controller.close();
          return;
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
            sendUpdate({ type: 'error', message: 'INSUFFICIENT_XRP_RESERVE' });
            controller.close();
            return;
          }

          sendUpdate({ 
            type: 'progress', 
            message: `Starting batch mint of ${count} NFTs...`,
            nftIndex: 0,
            total: count
          });

          const results = {
            totalProcessed: 0,
            totalRequested: count,
            nftokenIds: [] as string[],
            txHashes: [] as string[],
            errors: [] as Array<{ nftIndex: number; error: string; attempts: number }>
          };

          // Process each NFT sequentially
          for (let i = 1; i <= count; i++) {
            let nftokenId: string | undefined;
            let txHash: string | undefined;
            let attempts = 0;
            let lastError: string | undefined;
            let success = false;

            sendUpdate({ 
              type: 'progress', 
              message: `Processing NFT ${i}/${count}...`,
              nftIndex: i,
              total: count
            });

            // Try up to 3 times for each NFT
            while (attempts < 3 && !success) {
              attempts++;
              
              sendUpdate({ 
                type: 'progress', 
                message: `NFT ${i}/${count} - Attempt ${attempts}/3`,
                nftIndex: i,
                total: count,
                attempts
              });

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

                sendUpdate({ 
                  type: 'progress', 
                  message: `NFT ${i}/${count} - Submitting transaction...`,
                  nftIndex: i,
                  total: count,
                  attempts
                });

                // Submit transaction
                let response;
                
                if (process.env.XRPL_NETWORK === 'MAINNET') {
                  // Use submitAndWait for Mainnet
                  const prepared = await client.autofill(mintTransaction);
                  const signed = sellerWallet.sign(prepared);
                  response = await client.submitAndWait(signed.tx_blob);
                  txHash = response.result.hash;
                } else {
                  // Use regular submit for Testnet
                  response = await client.submit(mintTransaction, { wallet: sellerWallet });
                  
                  if (response.result.engine_result !== 'tesSUCCESS') {
                    lastError = `XRPL request failed: ${response.result.engine_result_message}`;
                    sendUpdate({ 
                      type: 'error', 
                      message: `NFT ${i}/${count} - ${lastError}`,
                      nftIndex: i,
                      total: count,
                      error: lastError,
                      attempts
                    });
                    continue;
                  }
                  txHash = response.result.tx_json.hash;
                }

                sendUpdate({ 
                  type: 'progress', 
                  message: `NFT ${i}/${count} - Waiting for validation...`,
                  nftIndex: i,
                  total: count,
                  txHash,
                  attempts
                });
                
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
                      
                      sendUpdate({ 
                        type: 'progress', 
                        message: `NFT ${i}/${count} - Validation attempt ${validationAttempts}/30`,
                        nftIndex: i,
                        total: count,
                        txHash,
                        attempts
                      });
                    } catch {
                      validationAttempts++;
                      sendUpdate({ 
                        type: 'progress', 
                        message: `NFT ${i}/${count} - Validation error, retrying...`,
                        nftIndex: i,
                        total: count,
                        txHash,
                        attempts
                      });
                      txResult = { result: { validated: false } };
                    }
                  } while (!txResult.result.validated && validationAttempts < 30);

                  if (!txResult.result.validated) {
                    lastError = `Transaction validation timeout after 30 seconds`;
                    sendUpdate({ 
                      type: 'error', 
                      message: `NFT ${i}/${count} - ${lastError}`,
                      nftIndex: i,
                      total: count,
                      error: lastError,
                      attempts
                    });
                    continue;
                  }

                  const meta = txResult.result.meta as { nftoken_id?: string; AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }> };
                  nftokenId = meta?.nftoken_id || meta?.AffectedNodes?.find((node: { CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } }) => 
                    node.CreatedNode?.LedgerEntryType === 'NFToken'
                  )?.CreatedNode?.NewFields?.NFTokenID;
                }

                if (!nftokenId) {
                  lastError = 'Could not extract NFTokenID from transaction metadata';
                  sendUpdate({ 
                    type: 'error', 
                    message: `NFT ${i}/${count} - ${lastError}`,
                    nftIndex: i,
                    total: count,
                    error: lastError,
                    attempts
                  });
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
                sendUpdate({ 
                  type: 'success', 
                  message: `NFT ${i}/${count} minted successfully!`,
                  nftIndex: i,
                  total: count,
                  nftokenId,
                  txHash
                });

              } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';
                sendUpdate({ 
                  type: 'error', 
                  message: `NFT ${i}/${count} - Attempt ${attempts} failed: ${lastError}`,
                  nftIndex: i,
                  total: count,
                  error: lastError,
                  attempts
                });
                
                // If it's a timeout error, wait 30 seconds before retry
                if (lastError.toLowerCase().includes('timeout') && attempts < 3) {
                  sendUpdate({ 
                    type: 'progress', 
                    message: `NFT ${i}/${count} - Timeout detected, waiting 30 seconds...`,
                    nftIndex: i,
                    total: count,
                    attempts
                  });
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
              sendUpdate({ 
                type: 'error', 
                message: `NFT ${i}/${count} failed after 3 attempts, stopping batch process`,
                nftIndex: i,
                total: count,
                error: lastError || 'Unknown error',
                attempts: 3
              });
              break;
            }
          }

          sendUpdate({ 
            type: 'complete', 
            message: `Batch mint completed: ${results.totalProcessed}/${count} NFTs processed`,
            nftIndex: results.totalProcessed,
            total: count
          });

        } finally {
          await client.disconnect();
        }

      } catch (error) {
        sendUpdate({ 
          type: 'error', 
          message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
