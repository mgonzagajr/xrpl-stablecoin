import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'xrpl';
import fs from 'fs';
import path from 'path';
import { WalletData } from '@/types/wallet';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    if (!role || !['seller', 'buyer'].includes(role)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_ROLE' },
        { status: 400 }
      );
    }

    // Load wallets
    const walletsPath = path.join(process.cwd(), 'data', 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
      return NextResponse.json(
        { ok: false, error: 'WALLETS_NOT_FOUND' },
        { status: 400 }
      );
    }

    const wallets: WalletData = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
    const targetWallet = wallets.wallets.find(w => w.role === role);
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'WALLET_NOT_FOUND' },
        { status: 400 }
      );
    }
    const targetAddress = targetWallet.address;

    // Connect to XRPL
    const client = new Client(process.env.XRPL_WS_URL!);
    await client.connect();

    try {
      // Get account NFTs
      const response = await client.request({
        command: 'account_nfts',
        account: targetAddress,
      });

      const nfts = response.result.account_nfts.map((nft: { NFTokenID: string; URI?: string }) => ({
        nftokenId: nft.NFTokenID,
        uri: nft.URI ? Buffer.from(nft.URI, 'hex').toString('utf8') : undefined,
      }));

      return NextResponse.json({
        ok: true,
        data: {
          role,
          nfts,
        },
      });

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('NFT list error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
