import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import { WalletData, ApiResponse } from '@/types/wallet';

const WALLETS_FILE_PATH = path.join(process.cwd(), 'data', 'wallets.json');

export async function GET(): Promise<NextResponse<ApiResponse<WalletData['configuration']>>> {
  try {
    if (!fsSync.existsSync(WALLETS_FILE_PATH)) {
      return NextResponse.json(
        { ok: false, error: 'NOT_INITIALIZED' },
        { status: 404 }
      );
    }

    const existingData = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
    const walletsData: WalletData = JSON.parse(existingData);

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
