import { NextResponse } from 'next/server';
import { Client, Wallet, AccountSet } from 'xrpl';
import * as xrpl from 'xrpl';
import fs from 'fs';
import path from 'path';
import { ensureFunded } from '@/lib/xrpl-helpers';

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
  configuration?: {
    issuerFlags?: {
      configured: boolean;
      configuredAt?: string;
      flags: {
        defaultRipple: boolean;
        requireAuth: boolean;
        noFreeze: boolean;
      };
    };
    trustLines?: {
      configured: boolean;
      configuredAt?: string;
      currency: string;
      limit: string;
      results: Array<{
        role: string;
        address: string;
        created: boolean;
        txHash?: string;
      }>;
    };
  };
}

interface IssuerFlagsResponse {
  issuer: {
    address: string;
    flags: {
      defaultRipple: boolean;
      requireAuth: boolean;
      noFreeze: boolean;
    };
  };
  changed: boolean;
  funding?: {
    status: 'ok' | 'funded' | 'error';
    address: string;
    balanceXrp?: number;
  };
}

export async function POST() {
  try {
    // Read wallets from file
    const walletsPath = path.join(process.cwd(), 'data', 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS_STORE' },
        { status: 500 }
      );
    }

    const walletsData: WalletData = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
    const issuerWallet = walletsData.wallets.find(w => w.role === 'issuer');
    
    if (!issuerWallet) {
      return NextResponse.json(
        { ok: false, error: 'ISSUER_WALLET_NOT_FOUND' },
        { status: 500 }
      );
    }

    // Environment variables
    const wsUrl = process.env.XRPL_WS_URL || 'wss://s.altnet.rippletest.net:51233';
    const sourceTag = Number(process.env.XRPL_SOURCE_TAG) || 0;
    const requireAuth = process.env.XRPL_REQUIRE_AUTH === 'true';
    const noFreeze = process.env.XRPL_NO_FREEZE === 'true';
    const minXrp = Number(process.env.XRPL_MIN_XRP) || 10;

    // Connect to XRPL
    const client = new Client(wsUrl);
    await client.connect();

    try {
      // Ensure issuer is funded
      const issuerWalletInstance = Wallet.fromSeed(issuerWallet.seed);
      const fundingResult = await ensureFunded(client, issuerWalletInstance, minXrp);
      
      if (fundingResult.status === 'error') {
        await client.disconnect();
        return NextResponse.json(
          { 
            ok: false, 
            error: 'INSUFFICIENT_BALANCE',
            details: { address: fundingResult.address }
          },
          { status: 500 }
        );
      }

      // Get current flags
      const issuerAccountInfo = await client.request({
        command: 'account_info',
        account: issuerWallet.address,
        ledger_index: 'validated'
      });
      
      const currentFlags = issuerAccountInfo.result.account_data.Flags || 0;
      const currentDefaultRipple = (currentFlags & xrpl.AccountSetAsfFlags.asfDefaultRipple) !== 0;
      const currentRequireAuth = (currentFlags & xrpl.AccountSetAsfFlags.asfRequireAuth) !== 0;
      const currentNoFreeze = (currentFlags & xrpl.AccountSetAsfFlags.asfNoFreeze) !== 0;

      // Determine what needs to be set
      const needsDefaultRipple = !currentDefaultRipple;
      const needsRequireAuth = requireAuth && !currentRequireAuth;
      const needsNoFreeze = noFreeze && !currentNoFreeze;

      let changed = false;

      // Set DefaultRipple (always)
      if (needsDefaultRipple) {
        const accountSetTx: AccountSet = {
          TransactionType: 'AccountSet',
          Account: issuerWallet.address,
          SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
          SourceTag: sourceTag
        };

        const prepared = await client.autofill(accountSetTx);
        const signed = issuerWalletInstance.sign(prepared);
        await client.submitAndWait(signed.tx_blob);
        changed = true;
      }

      // Set RequireAuth if needed
      if (needsRequireAuth) {
        const accountSetTx: AccountSet = {
          TransactionType: 'AccountSet',
          Account: issuerWallet.address,
          SetFlag: xrpl.AccountSetAsfFlags.asfRequireAuth,
          SourceTag: sourceTag
        };

        const prepared = await client.autofill(accountSetTx);
        const signed = issuerWalletInstance.sign(prepared);
        await client.submitAndWait(signed.tx_blob);
        changed = true;
      }

      // Set NoFreeze if needed (one-way, irreversible)
      if (needsNoFreeze) {
        const accountSetTx: AccountSet = {
          TransactionType: 'AccountSet',
          Account: issuerWallet.address,
          SetFlag: xrpl.AccountSetAsfFlags.asfNoFreeze,
          SourceTag: sourceTag
        };

        const prepared = await client.autofill(accountSetTx);
        const signed = issuerWalletInstance.sign(prepared);
        await client.submitAndWait(signed.tx_blob);
        changed = true;
      }

      await client.disconnect();

      // Update wallets.json with configuration status
      const updatedWalletsData = {
        ...walletsData,
        configuration: {
          ...walletsData.configuration,
          issuerFlags: {
            configured: true,
            configuredAt: new Date().toISOString(),
            flags: {
              defaultRipple: currentDefaultRipple || needsDefaultRipple,
              requireAuth: currentRequireAuth || needsRequireAuth,
              noFreeze: currentNoFreeze || needsNoFreeze
            }
          }
        }
      };

      // Save updated configuration to wallets.json
      fs.writeFileSync(walletsPath, JSON.stringify(updatedWalletsData, null, 2));

      const response: IssuerFlagsResponse = {
        issuer: {
          address: issuerWallet.address,
          flags: {
            defaultRipple: currentDefaultRipple || needsDefaultRipple,
            requireAuth: currentRequireAuth || needsRequireAuth,
            noFreeze: currentNoFreeze || needsNoFreeze
          }
        },
        changed,
        funding: {
          status: fundingResult.status,
          address: fundingResult.address,
          balanceXrp: fundingResult.balanceXrp
        }
      };

      return NextResponse.json({ ok: true, data: response });

    } catch (xrplError) {
      await client.disconnect();
      console.error('XRPL error:', xrplError);
      return NextResponse.json(
        { ok: false, error: 'XRPL_REQUEST_FAILED' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    );
  }
}
