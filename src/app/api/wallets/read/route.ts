import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { WalletData, ApiResponse, WalletsApiData } from '@/types/wallet';

// POC storage - NOT production grade secret management
const WALLETS_FILE_PATH = path.join(process.cwd(), 'data', 'wallets.json');

export async function GET(): Promise<NextResponse<ApiResponse<WalletsApiData>>> {
  try {
    // Check if wallets file exists
    try {
      const data = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
      const wallets: WalletData = JSON.parse(data);
      
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
    } catch {
      // File doesn't exist
      return NextResponse.json(
        { ok: false, error: 'NOT_INITIALIZED' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error reading wallets:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to read wallets' },
      { status: 500 }
    );
  }
}
