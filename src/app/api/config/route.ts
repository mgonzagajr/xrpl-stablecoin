import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const config = {
      minXrp: Number(process.env.XRPL_MIN_XRP) || 10,
      network: process.env.XRPL_NETWORK || 'TESTNET',
      currencyCode: process.env.XRPL_CURRENCY_CODE || 'SBR',
      trustLimit: process.env.XRPL_TRUST_LIMIT || '1000000000',
      requireAuth: process.env.XRPL_REQUIRE_AUTH === 'true',
      noFreeze: process.env.XRPL_NO_FREEZE === 'true',
      autoFaucet: process.env.XRPL_AUTO_FAUCET === 'true',
      sourceTag: Number(process.env.XRPL_SOURCE_TAG) || 0,
      defaultIssue: process.env.XRPL_DEFAULT_ISSUE || '1000000',
      defaultDistribute: process.env.XRPL_DEFAULT_DISTRIBUTE || '100'
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
