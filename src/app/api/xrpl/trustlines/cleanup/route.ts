import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
import { getWebSocketUrl } from '@/lib/network-config';
import { loadData } from '@/lib/vercel-storage';
import { WalletData } from '@/types/wallet';

export async function GET() {
  try {
    const walletsData = await loadData<WalletData>('wallets.json');
    if (!walletsData) {
      return NextResponse.json({
        ok: false,
        error: 'Wallets not found'
      }, { status: 404 });
    }
    const issuerWallet = walletsData.wallets.find(w => w.role === 'issuer');
    
    if (!issuerWallet) {
      return NextResponse.json({
        ok: false,
        error: 'Issuer wallet not found'
      }, { status: 404 });
    }

    const client = new Client(getWebSocketUrl());
    await client.connect();

    try {
      // Get all trust lines for the issuer
      const accountLines = await client.request({
        command: 'account_lines',
        account: issuerWallet.address,
        ledger_index: 'validated'
      });

      const allTrustLines = accountLines.result.lines || [];
      
      // Get known wallet addresses
      const knownAddresses = walletsData.wallets.map(w => w.address);
      
      // Separate trust lines into necessary and unnecessary
      const necessaryTrustLines = allTrustLines.filter(line => 
        knownAddresses.includes(line.account)
      );
      
      const unnecessaryTrustLines = allTrustLines.filter(line => 
        !knownAddresses.includes(line.account)
      );

      // Calculate potential XRP savings
      const potentialSavings = unnecessaryTrustLines.length * 0.2;

      await client.disconnect();

      return NextResponse.json({
        ok: true,
        data: {
          issuer: issuerWallet.address,
          totalTrustLines: allTrustLines.length,
          necessaryTrustLines: necessaryTrustLines.length,
          unnecessaryTrustLines: unnecessaryTrustLines.length,
          potentialSavingsXrp: potentialSavings,
          necessary: necessaryTrustLines.map(line => ({
            account: line.account,
            currency: line.currency,
            balance: line.balance,
            limit: line.limit,
            role: walletsData.wallets.find(w => w.address === line.account)?.role || 'unknown'
          })),
          unnecessary: unnecessaryTrustLines.map(line => ({
            account: line.account,
            currency: line.currency,
            balance: line.balance,
            limit: line.limit
          }))
        }
      });

    } catch (error) {
      await client.disconnect();
      throw error;
    }

  } catch (error) {
    console.error('Error fetching trust lines:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { trustLinesToRemove } = await request.json();
    
    if (!trustLinesToRemove || !Array.isArray(trustLinesToRemove)) {
      return NextResponse.json({
        ok: false,
        error: 'trustLinesToRemove array is required'
      }, { status: 400 });
    }

    const walletsData = await loadData<WalletData>('wallets.json');
    if (!walletsData) {
      return NextResponse.json({
        ok: false,
        error: 'Wallets not found'
      }, { status: 404 });
    }
    const issuerWallet = walletsData.wallets.find(w => w.role === 'issuer');
    
    if (!issuerWallet) {
      return NextResponse.json({
        ok: false,
        error: 'Issuer wallet not found'
      }, { status: 404 });
    }

    const client = new Client(getWebSocketUrl());
    await client.connect();

    try {
      const results = [];
      
      for (const trustLine of trustLinesToRemove) {
        try {
          // Create TrustSet transaction to remove trust line (set limit to 0 and clear NoRipple flag)
          const trustSetTx = {
            TransactionType: 'TrustSet',
            Account: issuerWallet.address,
            LimitAmount: {
              currency: trustLine.currency,
              issuer: trustLine.account,
              value: '0'
            },
            Flags: 0x00010000 // tfSetNoRipple - set NoRipple to false
          };

          // Submit transaction
          const issuerXrplWallet = Wallet.fromSeed(issuerWallet.seed);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response = await client.submitAndWait(trustSetTx as any, {
            wallet: issuerXrplWallet
          });

          results.push({
            account: trustLine.account,
            currency: trustLine.currency,
            success: true,
            txHash: response.result.hash,
            xrpSaved: 0.2
          });

        } catch (error) {
          results.push({
            account: trustLine.account,
            currency: trustLine.currency,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await client.disconnect();

      const successful = results.filter(r => r.success).length;
      const totalXrpSaved = successful * 0.2;

      return NextResponse.json({
        ok: true,
        data: {
          totalProcessed: results.length,
          successful,
          failed: results.length - successful,
          totalXrpSaved,
          results
        }
      });

    } catch (error) {
      await client.disconnect();
      throw error;
    }

  } catch (error) {
    console.error('Error removing trust lines:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
