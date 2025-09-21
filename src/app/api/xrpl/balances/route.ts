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
    const currencyCode = process.env.XRPL_CURRENCY_CODE || 'SBR';

    // Get WebSocket URL from network config
    const wsUrl = getWebSocketUrl();

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
        currency: currencyCode,
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
