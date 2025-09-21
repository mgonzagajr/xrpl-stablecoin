import { NextResponse } from 'next/server';
import { WalletData, ApiResponse, WalletsApiData } from '@/types/wallet';
import { loadData } from '@/lib/vercel-storage';

export async function GET(): Promise<NextResponse<ApiResponse<WalletsApiData>>> {
  try {
    // Load wallets from storage
    const wallets = await loadData<WalletData>('wallets.json');
    
    if (!wallets) {
      // Wallets don't exist
      return NextResponse.json(
        { ok: false, error: 'NOT_INITIALIZED' },
        { status: 404 }
      );
    }
    
    // Return wallets without secrets
    const response: WalletsApiData = {
      network: wallets.network,
      sourceTag: wallets.sourceTag,
      wallets: wallets.wallets.map(w => ({ role: w.role, address: w.address }))
    };

    return NextResponse.json({
      ok: true,
      data: response
    });
  } catch (error) {
    console.error('Error reading wallets:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to read wallets' },
      { status: 500 }
    );
  }
}
