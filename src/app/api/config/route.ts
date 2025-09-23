import { NextResponse } from 'next/server';
import { getNetworkInfo } from '@/lib/network-config';

export async function GET() {
  try {
    const networkInfo = getNetworkInfo();
    const config = {
      minXrp: Number(process.env.XRPL_MIN_XRP),
      network: networkInfo.network,
      currencyCode: process.env.XRPL_CURRENCY_CODE,
      trustLimit: process.env.XRPL_TRUST_LIMIT,
      requireAuth: process.env.XRPL_REQUIRE_AUTH === 'true',
      noFreeze: process.env.XRPL_NO_FREEZE === 'true',
      autoFaucet: process.env.XRPL_AUTO_FAUCET === 'true' && networkInfo.hasFaucet,
      sourceTag: Number(process.env.XRPL_SOURCE_TAG),
      defaultIssue: process.env.XRPL_DEFAULT_ISSUE,
      defaultDistribute: process.env.XRPL_DEFAULT_DISTRIBUTE,
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
