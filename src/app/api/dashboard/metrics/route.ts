import { NextResponse } from 'next/server';
import { loadData } from '@/lib/vercel-storage';
import { fetchTransactionsWithSourceTag } from '@/lib/transaction-helper';
import { getXrplApiUrl } from '@/lib/network-config';

interface DashboardMetrics {
  marketCap: {
    currency: string;
    brl: string;
    usd: string;
  };
  volume: {
    currency: string;
    brl: string;
    usd: string;
  };
  totalTransactions: number;
  conversionRate: {
    currencyToBrl: number;
    brlToUsd: number;
    currencyToUsd: number;
  };
  lastUpdated: string;
}


// Cache para taxa USD (simulado - em produção usaria Vercel Storage)
let usdRateCache: { rate: number; timestamp: number } | null = null;

async function getUsdRate(): Promise<number> {
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  if (usdRateCache && (Date.now() - usdRateCache.timestamp < CACHE_DURATION)) {
    return usdRateCache.rate;
  }

  try {
    // Using a public API for BRL to USD conversion
    // For production, consider a more robust and authenticated service
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/BRL');
    const data = await response.json();
    if (data && data.rates && data.rates.USD) {
      const rate = data.rates.USD;
      usdRateCache = { rate, timestamp: Date.now() };
      return rate;
    }
  } catch (error) {
    console.error('Error fetching BRL to USD rate:', error);
  }

  // Fallback to a default rate if API fails or cache is empty
  return usdRateCache?.rate || 0.187; // Default fallback rate
}

export async function GET() {
  try {
    // Load wallets
    const walletsData = await loadData<{ wallets: Array<{ role: string; address: string; seed: string }> }>('wallets.json');
    if (!walletsData) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS_STORE' },
        { status: 500 }
      );
    }

    const issuerWallet = walletsData.wallets.find(w => w.role === 'issuer');
    if (!issuerWallet) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_ISSUER_WALLET' },
        { status: 500 }
      );
    }

    const currencyCode = process.env.XRPL_CURRENCY_CODE || 'SBR';
    const sourceTag = process.env.XRPL_SOURCE_TAG || '846813574';
    const brlToUsdRate = await getUsdRate();

    let totalSbrInCirculation = 0;
    let totalVolume = 0;
    let transactionCount = 0;

    // Get issuer's account lines to find total stablecoin in circulation
    const issuerResponse = await fetch(getXrplApiUrl(), {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'XRPL-Stablecoin-Dashboard/1.0'
      },
      body: JSON.stringify({
        method: 'account_lines',
        params: [{
          account: issuerWallet.address,
          ledger_index: 'validated'
        }]
      })
    });

    if (!issuerResponse.ok) {
      throw new Error(`XRPL API error: ${issuerResponse.status} ${issuerResponse.statusText}`);
    }

    const issuerData = await issuerResponse.json();
    if (issuerData.result && issuerData.result.lines) {
      // Sum NEGATIVE balances of all trustlines for the stablecoin
      // In XRPL, negative balance means the issuer owes tokens (tokens in circulation)
      for (const line of issuerData.result.lines) {
        if (line.currency === currencyCode) {
          const balance = parseFloat(line.balance);
          if (balance < 0) {
            // Convert negative balance to positive for circulating supply
            totalSbrInCirculation += Math.abs(balance);
          }
        }
      }
    }

        // Get transaction statistics using centralized function
        const transactionStats = await fetchTransactionsWithSourceTag(
          walletsData.wallets,
          currencyCode,
          sourceTag,
          true // include volume calculation
        );
        
        transactionCount = transactionStats.totalTransactions;
        totalVolume = transactionStats.totalVolume;

    // Calculate conversions
    const totalBrl = totalSbrInCirculation; // 1 currency = 1 BRL
    const totalUsd = totalBrl * brlToUsdRate;
    
    const volumeBrl = totalVolume; // 1 currency = 1 BRL
    const volumeUsd = volumeBrl * brlToUsdRate;

    const metrics: DashboardMetrics = {
      marketCap: {
        currency: totalSbrInCirculation.toFixed(2),
        brl: totalBrl.toFixed(2),
        usd: totalUsd.toFixed(2)
      },
      volume: {
        currency: totalVolume.toFixed(2),
        brl: volumeBrl.toFixed(2),
        usd: volumeUsd.toFixed(2)
      },
      totalTransactions: transactionCount,
      conversionRate: {
        currencyToBrl: 1.0, // Fixed rate
        brlToUsd: brlToUsdRate,
        currencyToUsd: brlToUsdRate // Same as BRL since 1 currency = 1 BRL
      },
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({
      ok: true,
      data: metrics
    });
  } catch (error: unknown) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' },
      { status: 500 }
    );
  }
}