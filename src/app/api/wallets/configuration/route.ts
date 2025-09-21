import { NextResponse } from 'next/server';
import { loadData } from '@/lib/vercel-storage';
import { WalletData, ApiResponse } from '@/types/wallet';

export async function GET(): Promise<NextResponse<ApiResponse<WalletData['configuration']>>> {
  try {
    // Load wallets from storage (Vercel Blob in production, local file in development)
    const walletsData = await loadData<WalletData>('wallets.json');
    if (!walletsData) {
      return NextResponse.json(
        { ok: false, error: 'NOT_INITIALIZED' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      data: walletsData.configuration || undefined 
    });

  } catch (error) {
    console.error('Error fetching wallet configuration:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch wallet configuration' },
      { status: 500 }
    );
  }
}
