import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
import fs from 'fs';
import path from 'path';
import { ensureFunded } from '@/lib/xrpl-helpers';
import { ensureIssuerAuthorization } from '@/lib/issuer-auth';

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

interface IssueRequest {
  amount?: string;
  idempotencyKey?: string;
}

interface IssueResponse {
  txHash: string;
  amount: string;
  currency: string;
  from: string;
  to: string;
}

// Simple idempotency storage (POC only)
const TX_LOG_PATH = path.join(process.cwd(), 'data', 'txlog.json');

function validateAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && /^\d+(\.\d+)?$/.test(amount);
}

function checkIdempotency(kind: string, key: string): string | null {
  try {
    if (!fs.existsSync(TX_LOG_PATH)) {
      return null;
    }
    
    const txLog = JSON.parse(fs.readFileSync(TX_LOG_PATH, 'utf8'));
    const entry = txLog.find((entry: { kind: string; key: string }) => entry.kind === kind && entry.key === key);
    return entry?.txHash || null;
  } catch {
    return null;
  }
}

function logTransaction(kind: string, key: string, txHash: string) {
  try {
    const dataDir = path.dirname(TX_LOG_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let txLog = [];
    if (fs.existsSync(TX_LOG_PATH)) {
      txLog = JSON.parse(fs.readFileSync(TX_LOG_PATH, 'utf8'));
    }

    txLog.push({
      kind,
      key,
      txHash,
      at: new Date().toISOString()
    });

    fs.writeFileSync(TX_LOG_PATH, JSON.stringify(txLog, null, 2));
  } catch (error) {
    console.warn('Failed to log transaction:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: IssueRequest = await request.json();
    const { amount, idempotencyKey } = body;

    // Validate amount
    const issueAmount = amount || process.env.XRPL_DEFAULT_ISSUE || '1000000';
    if (!validateAmount(issueAmount)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }

    // Check idempotency
    if (idempotencyKey) {
      const existingTxHash = checkIdempotency('issue', idempotencyKey);
      if (existingTxHash) {
        return NextResponse.json({
          ok: true,
          data: {
            txHash: existingTxHash,
            amount: issueAmount,
            currency: process.env.XRPL_CURRENCY_CODE || 'SBR',
            from: 'issuer',
            to: 'hot'
          }
        });
      }
    }

    // Read wallets
    const walletsPath = path.join(process.cwd(), 'data', 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS_STORE' },
        { status: 500 }
      );
    }

    const walletsData: WalletData = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
    const issuerWallet = walletsData.wallets.find(w => w.role === 'issuer');
    const hotWallet = walletsData.wallets.find(w => w.role === 'hot');

    if (!issuerWallet || !hotWallet) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS' },
        { status: 500 }
      );
    }

    // Environment variables
    const wsUrl = process.env.XRPL_WS_URL || 'wss://s.altnet.rippletest.net:51233';
    const sourceTag = Number(process.env.XRPL_SOURCE_TAG) || 0;
    const currencyCode = process.env.XRPL_CURRENCY_CODE || 'SBR';
    const minXrp = Number(process.env.XRPL_MIN_XRP) || 10;
    const requireAuth = process.env.XRPL_REQUIRE_AUTH === 'true';

    // Connect to XRPL
    const client = new Client(wsUrl);
    await client.connect();

    try {
      // Ensure issuer is funded
      const issuerXrplWallet = Wallet.fromSeed(issuerWallet.seed);
      const fundingResult = await ensureFunded(client, issuerXrplWallet, minXrp);
      
      if (fundingResult.status === 'error') {
        await client.disconnect();
        return NextResponse.json(
          { ok: false, error: 'INSUFFICIENT_BALANCE' },
          { status: 400 }
        );
      }

      // Check if hot has trust line to issuer
      const hotAccountLines = await client.request({
        command: 'account_lines',
        account: hotWallet.address,
        ledger_index: 'validated'
      });

      const trustLine = hotAccountLines.result.lines.find((line: { account: string; currency: string }) => 
        line.account === issuerWallet.address && line.currency === currencyCode
      );

      if (!trustLine) {
        await client.disconnect();
        return NextResponse.json(
          { ok: false, error: 'MISSING_TRUSTLINE' },
          { status: 400 }
        );
      }

      // If RequireAuth is enabled, ensure issuer has authorized the hot trust line
      if (requireAuth) {
        const authResult = await ensureIssuerAuthorization(
          client,
          issuerXrplWallet,
          hotWallet.address,
          currencyCode,
          sourceTag
        );

        if (authResult.status === 'error') {
          await client.disconnect();
          return NextResponse.json(
            { ok: false, error: authResult.errorCode || 'NOT_AUTHORIZED' },
            { status: 400 }
          );
        }
      }

      // Submit Payment from issuer to hot
      const paymentTx = {
        TransactionType: 'Payment' as const,
        Account: issuerWallet.address,
        Destination: hotWallet.address,
        Amount: {
          currency: currencyCode,
          issuer: issuerWallet.address,
          value: issueAmount
        },
        SourceTag: sourceTag
      };

      const prepared = await client.autofill(paymentTx);
      const signed = issuerXrplWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if ((result.result.meta as { TransactionResult?: string })?.TransactionResult === 'tesSUCCESS') {
        const txHash = result.result.hash;
        
        // Log transaction for idempotency
        if (idempotencyKey) {
          logTransaction('issue', idempotencyKey, txHash);
        }

        await client.disconnect();

        const response: IssueResponse = {
          txHash,
          amount: issueAmount,
          currency: currencyCode,
          from: issuerWallet.address,
          to: hotWallet.address
        };

        return NextResponse.json({ ok: true, data: response });
      } else {
        await client.disconnect();
        return NextResponse.json(
          { ok: false, error: 'PAYMENT_FAILED' },
          { status: 500 }
        );
      }

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
