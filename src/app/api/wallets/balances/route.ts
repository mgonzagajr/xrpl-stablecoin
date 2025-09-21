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

interface WalletBalance {
  role: string;
  address: string;
  balanceXrp: number;
  balanceDrops: string;
  balanceSbr?: string;
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

    // Get WebSocket URL from network config
    const wsUrl = getWebSocketUrl();

    // Connect to XRPL
    const client = new Client(wsUrl);
    await client.connect();

    try {
      const balances: WalletBalance[] = [];

      const currencyCode = process.env.XRPL_CURRENCY_CODE || 'SBR';
      const issuerAddress = walletsData.wallets.find(w => w.role === 'issuer')?.address;

      for (const wallet of walletsData.wallets) {
        try {
          const accountInfo = await client.request({
            command: 'account_info',
            account: wallet.address,
            ledger_index: 'validated'
          });

          const balanceDrops = accountInfo.result.account_data.Balance;
          const balanceXrp = Number(balanceDrops) / 1000000; // Convert drops to XRP

          // Get SBR balance (if any)
          let sbrBalance = '0';
          try {
            const accountLines = await client.request({
              command: 'account_lines',
              account: wallet.address,
              ledger_index: 'validated'
            });

            // Find SBR line to issuer
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

          balances.push({
            role: wallet.role,
            address: wallet.address,
            balanceXrp: Math.round(balanceXrp * 1000000) / 1000000, // Round to 6 decimal places
            balanceDrops: balanceDrops,
            balanceSbr: sbrBalance
          });
        } catch {
          // Account might not exist or have insufficient balance
          balances.push({
            role: wallet.role,
            address: wallet.address,
            balanceXrp: 0,
            balanceDrops: '0',
            balanceSbr: '0'
          });
        }
      }

      await client.disconnect();

      return NextResponse.json({ 
        ok: true, 
        data: {
          network: walletsData.network,
          sourceTag: walletsData.sourceTag,
          balances
        }
      });

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
