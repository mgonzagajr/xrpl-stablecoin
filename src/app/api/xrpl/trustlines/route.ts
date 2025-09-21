import { NextResponse } from 'next/server';
import { Client, Wallet, TrustSet } from 'xrpl';
import { getWebSocketUrl } from '@/lib/network-config';
import { loadData, saveData } from '@/lib/vercel-storage';
import { ensureFunded } from '@/lib/xrpl-helpers';

interface WalletData {
  version: number;
  createdAt: string;
  network: 'TESTNET' | 'MAINNET';
  sourceTag: number;
  wallets: Array<{
    role: string;
    address: string;
    publicKey: string;
    privateKey: string;
    seed: string;
  }>;
  configuration?: {
    issuerFlags?: {
      configured: boolean;
      configuredAt?: string;
      flags: {
        defaultRipple: boolean;
        requireAuth: boolean;
        noFreeze: boolean;
      };
    };
    trustLines?: {
      configured: boolean;
      configuredAt?: string;
      currency: string;
      limit: string;
      results: Array<{
        role: string;
        address: string;
        created: boolean;
        txHash?: string;
      }>;
    };
  };
}

interface TrustLineResult {
  role: 'hot' | 'seller' | 'buyer';
  address: string;
  created: boolean;
  txHash?: string;
  funding?: {
    status: 'ok' | 'funded' | 'error';
    address: string;
    balanceXrp?: number;
  };
}

interface TrustLinesResponse {
  currency: string;
  limit: string;
  results: TrustLineResult[];
}

export async function POST() {
  try {
    // Load wallets from storage (Vercel Blob in production, local file in development)
    const walletsData = await loadData<WalletData>('wallets.json');
    if (!walletsData) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS_STORE' },
        { status: 500 }
      );
    }
    const issuerWallet = walletsData.wallets.find(w => w.role === 'issuer');
    const hotWallet = walletsData.wallets.find(w => w.role === 'hot');
    const sellerWallet = walletsData.wallets.find(w => w.role === 'seller');
    const buyerWallet = walletsData.wallets.find(w => w.role === 'buyer');
    
    if (!issuerWallet || !hotWallet || !sellerWallet || !buyerWallet) {
      return NextResponse.json(
        { ok: false, error: 'REQUIRED_WALLETS_NOT_FOUND' },
        { status: 500 }
      );
    }

    // Get WebSocket URL from network config
    const wsUrl = getWebSocketUrl();
    const sourceTag = Number(process.env.XRPL_SOURCE_TAG) || 0;
    const currencyCode = process.env.XRPL_CURRENCY_CODE || 'SBR';
    const trustLimit = process.env.XRPL_TRUST_LIMIT || '1000000000';
    const minXrp = Number(process.env.XRPL_MIN_XRP) || 10;

    // Validate currency code
    if (!/^[A-Z]{3}$|^[A-F0-9]{40}$/.test(currencyCode)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_CURRENCY_CODE' },
        { status: 500 }
      );
    }

    // Validate trust limit
    const limitNumber = Number(trustLimit);
    if (isNaN(limitNumber) || limitNumber <= 0) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_TRUST_LIMIT' },
        { status: 500 }
      );
    }

    // Connect to XRPL
    const client = new Client(wsUrl);
    await client.connect();

    try {
      const results: TrustLineResult[] = [];
      const holderWallets = [
        { role: 'hot' as const, wallet: hotWallet },
        { role: 'seller' as const, wallet: sellerWallet },
        { role: 'buyer' as const, wallet: buyerWallet }
      ];

      for (const { role, wallet } of holderWallets) {
        try {
          // Ensure wallet is funded
          const walletInstance = Wallet.fromSeed(wallet.seed);
          const fundingResult = await ensureFunded(client, walletInstance, minXrp);
          
          if (fundingResult.status === 'error') {
            results.push({
              role,
              address: wallet.address,
              created: false,
              funding: {
                status: 'error',
                address: fundingResult.address
              }
            });
            continue;
          }

          // Check existing trust line
          const trustLines = await client.request({
            command: 'account_lines',
            account: wallet.address,
            peer: issuerWallet.address,
            ledger_index: 'validated'
          });

          const existingTrustLine = trustLines.result.lines.find((line: { currency: string; limit: string; limit_peer: string; freeze?: boolean; freeze_peer?: boolean }) => {
            if (currencyCode.length === 3) {
              return line.currency === currencyCode;
            } else {
              return line.currency === currencyCode;
            }
          });

          let created = false;
          let txHash: string | undefined;

          if (existingTrustLine) {
            const currentLimit = Number(existingTrustLine.limit);
            const currentLimitPeer = Number(existingTrustLine.limit_peer);
            const isFrozen = existingTrustLine.freeze || existingTrustLine.freeze_peer;

            // Check if trust line needs updating
            if (currentLimit < limitNumber || currentLimitPeer < limitNumber || isFrozen) {
              // Update trust line
              const trustSetTx: TrustSet = {
                TransactionType: 'TrustSet',
                Account: wallet.address,
                LimitAmount: {
                  currency: currencyCode,
                  issuer: issuerWallet.address,
                  value: trustLimit
                },
                SourceTag: sourceTag
              };

              const prepared = await client.autofill(trustSetTx);
              const signed = walletInstance.sign(prepared);
              const submitResult = await client.submitAndWait(signed.tx_blob);
              
              created = true;
              txHash = submitResult.result.hash;
            }
          } else {
            // Create new trust line
            const trustSetTx: TrustSet = {
              TransactionType: 'TrustSet',
              Account: wallet.address,
              LimitAmount: {
                currency: currencyCode,
                issuer: issuerWallet.address,
                value: trustLimit
              },
              SourceTag: sourceTag
            };

            const prepared = await client.autofill(trustSetTx);
            const signed = walletInstance.sign(prepared);
            const submitResult = await client.submitAndWait(signed.tx_blob);
            
            created = true;
            txHash = submitResult.result.hash;
          }

          results.push({
            role,
            address: wallet.address,
            created,
            txHash,
            funding: {
              status: fundingResult.status,
              address: fundingResult.address,
              balanceXrp: fundingResult.balanceXrp
            }
          });

        } catch (walletError) {
          console.error(`Error processing ${role} wallet:`, walletError);
          results.push({
            role,
            address: wallet.address,
            created: false,
            funding: {
              status: 'error',
              address: wallet.address
            }
          });
        }
      }

      await client.disconnect();

      // Check if any accounts failed funding
      const failedAccounts = results.filter(r => r.funding?.status === 'error');
      if (failedAccounts.length > 0) {
        return NextResponse.json(
          { 
            ok: false, 
            error: 'INSUFFICIENT_BALANCE',
            details: failedAccounts.map(r => ({ address: r.address }))
          },
          { status: 500 }
        );
      }

      // Update wallets.json with trust lines configuration status
      const updatedWalletsData = {
        ...walletsData,
        configuration: {
          ...walletsData.configuration,
          trustLines: {
            configured: true,
            configuredAt: new Date().toISOString(),
            currency: currencyCode,
            limit: trustLimit,
            results: results.map(r => ({
              role: r.role as 'issuer' | 'hot' | 'seller' | 'buyer',
              address: r.address,
              created: r.created,
              txHash: r.txHash
            }))
          }
        }
      };

      // Save updated configuration to storage
      await saveData('wallets.json', updatedWalletsData);

      const response: TrustLinesResponse = {
        currency: currencyCode,
        limit: trustLimit,
        results
      };

      return NextResponse.json({ ok: true, data: response });

    } catch (xrplError) {
      await client.disconnect();
      console.error('XRPL error:', xrplError);
      return NextResponse.json(
        { ok: false, error: 'XRPL_REQUEST_FAILED' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    );
  }
}
