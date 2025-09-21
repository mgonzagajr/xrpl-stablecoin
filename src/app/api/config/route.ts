import { NextResponse } from 'next/server';
import { getNetworkInfo } from '@/lib/network-config';

export async function GET() {
  try {
    const networkInfo = getNetworkInfo();
    const config = {
      minXrp: Number(process.env.XRPL_MIN_XRP) || networkInfo.recommendedMin,
      network: networkInfo.network,
      currencyCode: process.env.XRPL_CURRENCY_CODE || 'SBR',
      trustLimit: process.env.XRPL_TRUST_LIMIT || '1000000000',
      requireAuth: process.env.XRPL_REQUIRE_AUTH === 'true',
      noFreeze: process.env.XRPL_NO_FREEZE === 'true',
      autoFaucet: process.env.XRPL_AUTO_FAUCET === 'true' && networkInfo.hasFaucet,
      sourceTag: Number(process.env.XRPL_SOURCE_TAG) || 0,
      defaultIssue: process.env.XRPL_DEFAULT_ISSUE || '1000000',
      defaultDistribute: process.env.XRPL_DEFAULT_DISTRIBUTE || '100',
      networkInfo: {
        name: networkInfo.name,
        description: networkInfo.description,
        hasFaucet: networkInfo.hasFaucet,
        minReserve: networkInfo.minReserve
      }
    };

    return NextResponse.json({ 
      ok: true, 
      data: config 
    });

  } catch (error) {
    console.error('Config API error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}
