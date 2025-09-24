import { NextResponse } from 'next/server';
import { loadData } from '@/lib/vercel-storage';
import { fetchTransactionsWithSourceTag } from '@/lib/transaction-helper';

interface TransactionLog {
  hash: string;
  wallet: string;
  walletRole: string;
  type: string;
  sbrAmount?: string;
  date: string;
  fee: string;
  destination?: string;
}

export async function GET() {
  try {
    const walletsData = await loadData<{ wallets: Array<{ role: string; address: string; seed: string }> }>('wallets.json');
    if (!walletsData) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS_STORE' },
        { status: 500 }
      );
    }

    const currencyCode = process.env.XRPL_CURRENCY_CODE || 'SBR';
    const sourceTag = process.env.XRPL_SOURCE_TAG || '846813574';

    // Get transactions using centralized function
    const transactionStats = await fetchTransactionsWithSourceTag(
      walletsData.wallets,
      currencyCode,
      sourceTag,
      false // don't need volume calculation for this endpoint
    );

    // Convert to TransactionLog format for backward compatibility
    const transactions: TransactionLog[] = transactionStats.transactions.map(tx => ({
      hash: tx.hash,
      wallet: tx.wallet,
      walletRole: tx.walletRole,
      type: tx.type,
      sbrAmount: tx.sbrAmount,
      date: tx.date,
      fee: tx.fee,
      destination: tx.destination
    }));

    return NextResponse.json({
      ok: true,
      data: {
        transactions: transactions,
        total: transactions.length,
        sourceTag: sourceTag
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching source tag transactions:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' },
      { status: 500 }
    );
  }
}