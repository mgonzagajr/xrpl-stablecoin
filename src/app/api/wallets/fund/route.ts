import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'xrpl';
import fs from 'fs';
import path from 'path';

interface WalletData {
  version: number;
  createdAt: string;
  network: 'TESTNET' | 'MAINNET';
  sourceTag: number;
  wallets: Array<{
    role: string;
    address: string;
    publicKey: string;
    privateKey: string;
    seed: string;
  }>;
}

interface FundWalletResult {
  role: string;
  address: string;
  success: boolean;
  balanceXrp?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { role } = await request.json();
    
    if (!role || !['issuer', 'hot', 'seller', 'buyer'].includes(role)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid role. Must be issuer, hot, seller, or buyer' },
        { status: 400 }
      );
    }

    // Read wallets from file
    const walletsPath = path.join(process.cwd(), 'data', 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS_STORE' },
        { status: 500 }
      );
    }

    const walletsData: WalletData = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
    const wallet = walletsData.wallets.find(w => w.role === role);
    
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: `Wallet with role '${role}' not found` },
        { status: 404 }
      );
    }

    // Environment variables
    const wsUrl = process.env.XRPL_WS_URL || 'wss://s.altnet.rippletest.net:51233';
    const network = process.env.XRPL_NETWORK || 'TESTNET';
    const autoFaucet = process.env.XRPL_AUTO_FAUCET === 'true';

    // Only allow funding on TESTNET with auto-faucet enabled
    if (network !== 'TESTNET' || !autoFaucet) {
      return NextResponse.json(
        { ok: false, error: 'Funding only available on TESTNET with XRPL_AUTO_FAUCET=true' },
        { status: 400 }
      );
    }

    // Connect to XRPL
    const client = new Client(wsUrl);
    await client.connect();

    try {
      // Check if account exists
      let accountExists = false;
      try {
        await client.request({
          command: 'account_info',
          account: wallet.address,
          ledger_index: 'validated'
        });
        accountExists = true;
      } catch {
        // Account doesn't exist
        accountExists = false;
      }

      if (accountExists) {
        // Account exists - cannot use fundWallet()
        await client.disconnect();
        return NextResponse.json(
          { 
            ok: false, 
            error: 'Account already exists. XRPL.js fundWallet() only works for new accounts.',
            details: {
              address: wallet.address,
              suggestion: 'Use XRPL Testnet Faucet to fund existing account manually'
            }
          },
          { status: 400 }
        );
      }

      // Account doesn't exist - use fundWallet()
      console.log(`Funding new ${role} wallet: ${wallet.address}`);
      const fundingResult = await client.fundWallet();
      console.log(`Funded ${role} wallet:`, {
        address: wallet.address,
        balance: fundingResult.balance
      });

      // Wait a moment for the account to be available
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify the funding
      let balanceXrp = 0;
      try {
        const accountInfo = await client.request({
          command: 'account_info',
          account: wallet.address,
          ledger_index: 'validated'
        });
        const balanceDrops = Number(accountInfo.result.account_data.Balance);
        balanceXrp = balanceDrops / 1000000;
      } catch (error) {
        console.warn('Could not verify balance after funding:', error);
      }

      await client.disconnect();

      const result: FundWalletResult = {
        role,
        address: wallet.address,
        success: true,
        balanceXrp: Math.round(balanceXrp * 1000000) / 1000000
      };

      return NextResponse.json({ 
        ok: true, 
        data: result 
      });

    } catch (xrplError) {
      await client.disconnect();
      console.error('XRPL funding error:', xrplError);
      
      const result: FundWalletResult = {
        role,
        address: wallet.address,
        success: false,
        error: 'Failed to fund wallet via XRPL'
      };

      return NextResponse.json({ 
        ok: false, 
        error: 'XRPL_FUNDING_FAILED',
        details: result
      });
    }

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    );
  }
}
