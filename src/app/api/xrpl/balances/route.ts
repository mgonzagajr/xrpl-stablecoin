import { NextResponse } from 'next/server';
import { Client } from 'xrpl';
import { getWebSocketUrl } from '@/lib/network-config';
import { loadData } from '@/lib/vercel-storage';

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
}

interface BalanceEntry {
  role: 'issuer' | 'hot' | 'seller' | 'buyer';
  address: string;
  xrp: string;
  sbr?: string;
}

interface BalancesResponse {
  currency: string;
  entries: BalanceEntry[];
}

export async function GET() {
  try {
    // Load wallets from storage (Vercel Blob in production, local file in development)
    const walletsData = await loadData<WalletData>('wallets.json');
    if (!walletsData) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS_STORE' },
        { status: 500 }
      );
    }
    const currencyCode = process.env.XRPL_CURRENCY_CODE;

    // Get WebSocket URL from network config
    const wsUrl = getWebSocketUrl();
    
    // For development with mainnet, try real connection with timeout
    if (process.env.NODE_ENV !== 'production' && process.env.XRPL_NETWORK === 'MAINNET') {
      try {
        // Try to connect with a shorter timeout
        const client = new Client(wsUrl);
        await Promise.race([
          client.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
        ]);

        const entries: BalanceEntry[] = [];
        const issuerAddress = walletsData.wallets.find(w => w.role === 'issuer')?.address;

        for (const wallet of walletsData.wallets) {
          try {
            const accountInfo = await client.request({
              command: 'account_info',
              account: wallet.address
            });
            const xrpBalance = accountInfo.result.account_data.Balance;
            const xrp = (parseInt(xrpBalance) / 1000000).toString();
            
            // Check for SBR balance (tokens are not in account_data, they're in separate trust lines)
            let sbrBalance = '0';
            try {
              const trustLines = await client.request({
                command: 'account_lines',
                account: wallet.address,
                peer: issuerAddress
              });
              
              const sbrTrustLine = trustLines.result.lines.find(
                (line: { currency: string; balance: string }) => line.currency === currencyCode
              );
              if (sbrTrustLine) {
                sbrBalance = sbrTrustLine.balance;
              }
            } catch (err) {
              // If no trust lines or error, balance remains '0'
              console.log(`No trust lines found for ${wallet.address}`);
            }

            entries.push({
              role: wallet.role as 'issuer' | 'hot' | 'seller' | 'buyer',
              address: wallet.address,
              xrp,
              sbr: sbrBalance
            });
          } catch (err) {
            console.error(`Failed to get balance for ${wallet.address}:`, err);
            entries.push({
              role: wallet.role as 'issuer' | 'hot' | 'seller' | 'buyer',
              address: wallet.address,
              xrp: '0',
              sbr: '0'
            });
          }
        }

        await client.disconnect();
        return NextResponse.json({
          ok: true,
          data: {
            currency: currencyCode,
            entries
          }
        });
      } catch (err) {
        console.error('Failed to connect to mainnet, using mock data:', err);
        // Fallback to mock data if connection fails
        const entries: BalanceEntry[] = walletsData.wallets.map(wallet => ({
          role: wallet.role as 'issuer' | 'hot' | 'seller' | 'buyer',
          address: wallet.address,
          xrp: '0',
          sbr: '0'
        }));

        return NextResponse.json({
          ok: true,
          data: {
            currency: currencyCode,
            entries
          }
        });
      }
    }

    // Connect to XRPL
    const client = new Client(wsUrl);
    await client.connect();

    try {
      const entries: BalanceEntry[] = [];

      for (const wallet of walletsData.wallets) {
        try {
          // Get XRP balance
          const accountInfo = await client.request({
            command: 'account_info',
            account: wallet.address,
            ledger_index: 'validated'
          });

          const balanceDrops = accountInfo.result.account_data.Balance;
          const xrpBalance = (Number(balanceDrops) / 1000000).toFixed(6);

          // Get SBR balance (if any)
          let sbrBalance = '0';
          try {
            const accountLines = await client.request({
              command: 'account_lines',
              account: wallet.address,
              ledger_index: 'validated'
            });

            // Find SBR line to issuer
            const issuerAddress = walletsData.wallets.find(w => w.role === 'issuer')?.address;
            if (issuerAddress) {
            const sbrLine = accountLines.result.lines.find((line: { account: string; currency: string }) => 
              line.account === issuerAddress && line.currency === currencyCode
            );

              if (sbrLine) {
                sbrBalance = sbrLine.balance || '0';
              }
            }
          } catch {
            // No trust line exists, SBR balance is 0
            sbrBalance = '0';
          }

          entries.push({
            role: wallet.role as 'issuer' | 'hot' | 'seller' | 'buyer',
            address: wallet.address,
            xrp: xrpBalance,
            sbr: sbrBalance
          });

        } catch {
          // Account might not exist or have issues
          entries.push({
            role: wallet.role as 'issuer' | 'hot' | 'seller' | 'buyer',
            address: wallet.address,
            xrp: '0',
            sbr: '0'
          });
        }
      }

      await client.disconnect();

      const response: BalancesResponse = {
        currency: currencyCode!,
        entries
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
