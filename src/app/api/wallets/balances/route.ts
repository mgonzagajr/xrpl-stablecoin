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
  reserveBase: number;
  reserveOwner: number;
  reserveTotal: number;
  availableXrp: number;
}

// Function to calculate reserves
async function calculateReserves(client: Client, address: string) {
  try {
    const accountInfo = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    const accountData = accountInfo.result.account_data;
    
    // Base reserve: 1 XRP
    const reserveBase = 1;
    
    // Owner reserve: 0.2 XRP per object
    // OwnerCount includes trust lines, offers, NFTs, etc.
    let ownerCount = 0;
    if (accountData.OwnerCount) {
      // Handle both string and number types
      ownerCount = typeof accountData.OwnerCount === 'string' 
        ? parseInt(accountData.OwnerCount) 
        : accountData.OwnerCount;
    }
    
    // Always count trust lines manually for accurate reserve calculation
    // OwnerCount from account_info is often unreliable
    try {
      const accountLines = await client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated'
      });
      const trustLineCount = accountLines.result.lines ? accountLines.result.lines.length : 0;
      
      // Use the higher count between OwnerCount and manual trust line count
      ownerCount = Math.max(ownerCount, trustLineCount);
    } catch {
      // Silently handle error - trust line count will remain 0
    }
    
    const reserveOwner = ownerCount * 0.2;
    const reserveTotal = reserveBase + reserveOwner;
    
    return {
      reserveBase,
      reserveOwner,
      reserveTotal,
      ownerCount
    };
  } catch {
    console.error(`Error calculating reserves for ${address}`);
    // If account doesn't exist or error, return zero reserves
    return {
      reserveBase: 0,
      reserveOwner: 0,
      reserveTotal: 0,
      ownerCount: 0
    };
  }
}

// Simple cache to avoid repeated calls
let cache: { data: { ok: boolean; data: { network: 'TESTNET' | 'MAINNET'; sourceTag: number; balances: WalletBalance[] } }; timestamp: number } | null = null;
const CACHE_DURATION = 5000; // 5 seconds

export async function GET() {
  try {
    // Check cache first
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data);
    }

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
    
    // For development with mainnet, try real connection with timeout
    if (process.env.NODE_ENV !== 'production' && process.env.XRPL_NETWORK === 'MAINNET') {
      try {
        console.log(`Attempting to connect to MAINNET: ${wsUrl}`);
        // Try to connect with a longer timeout for mainnet
        const client = new Client(wsUrl);
        await Promise.race([
          client.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 30000))
        ]);
        console.log('Successfully connected to MAINNET');

        const balances: WalletBalance[] = [];
        const currencyCode = process.env.XRPL_CURRENCY_CODE;
        const issuerAddress = walletsData.wallets.find(w => w.role === 'issuer')?.address;

        for (const wallet of walletsData.wallets) {
          try {
            const accountInfo = await client.request({
              command: 'account_info',
              account: wallet.address
            });
            const xrpBalance = accountInfo.result.account_data.Balance;
            const balanceXrp = parseInt(xrpBalance) / 1000000;
            
            // Calculate reserves
            const reserves = await calculateReserves(client, wallet.address);
            
            // Check for SBR balance (tokens are not in account_data, they're in separate trust lines)
            let balanceSbr = '0';
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
                balanceSbr = sbrTrustLine.balance;
              }
            } catch {
              // If no trust lines or error, balance remains '0'
              console.log(`No trust lines found for ${wallet.address}`);
            }

            balances.push({
              role: wallet.role,
              address: wallet.address,
              balanceXrp,
              balanceDrops: xrpBalance,
              balanceSbr,
              reserveBase: reserves.reserveBase,
              reserveOwner: reserves.reserveOwner,
              reserveTotal: reserves.reserveTotal,
              availableXrp: Math.max(0, balanceXrp - reserves.reserveTotal)
            });
          } catch (err) {
            console.error(`Failed to get balance for ${wallet.address}:`, err);
            balances.push({
              role: wallet.role,
              address: wallet.address,
              balanceXrp: 0,
              balanceDrops: '0',
              balanceSbr: '0',
              reserveBase: 0,
              reserveOwner: 0,
              reserveTotal: 0,
              availableXrp: 0
            });
          }
        }

        await client.disconnect();
        
        const response = {
          ok: true,
          data: {
            network: walletsData.network,
            sourceTag: walletsData.sourceTag,
            balances
          }
        };
        
        // Cache the response
        cache = { data: response, timestamp: Date.now() };
        
        return NextResponse.json(response);
      } catch (err) {
        console.error('Failed to connect to mainnet:', err);
        // Don't use mock data, return error instead
        return NextResponse.json({
          ok: false,
          error: `Failed to connect to mainnet: ${err instanceof Error ? err.message : 'Unknown error'}`
        }, { status: 500 });
      }
    }

    // Connect to XRPL
    const client = new Client(wsUrl);
    await client.connect();

    try {
      const balances: WalletBalance[] = [];

      const currencyCode = process.env.XRPL_CURRENCY_CODE;
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

          // Calculate reserves
          const reserves = await calculateReserves(client, wallet.address);

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
            balanceSbr: sbrBalance,
            reserveBase: reserves.reserveBase,
            reserveOwner: reserves.reserveOwner,
            reserveTotal: reserves.reserveTotal,
            availableXrp: Math.max(0, balanceXrp - reserves.reserveTotal)
          });
        } catch {
          // Account might not exist or have insufficient balance
          balances.push({
            role: wallet.role,
            address: wallet.address,
            balanceXrp: 0,
            balanceDrops: '0',
            balanceSbr: '0',
            reserveBase: 0,
            reserveOwner: 0,
            reserveTotal: 0,
            availableXrp: 0
          });
        }
      }

      await client.disconnect();

      const response = { 
        ok: true, 
        data: {
          network: walletsData.network,
          sourceTag: walletsData.sourceTag,
          balances
        }
      };
      
      // Cache the response
      cache = { data: response, timestamp: Date.now() };
      
      return NextResponse.json(response);

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
