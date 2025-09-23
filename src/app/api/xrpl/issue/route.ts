import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
import { getWebSocketUrl } from '@/lib/network-config';
import { loadData, saveData } from '@/lib/vercel-storage';
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

// Idempotency storage using Vercel Blob

function validateAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && /^\d+(\.\d+)?$/.test(amount);
}

interface TransactionLogEntry {
  kind: string;
  key: string;
  txHash: string;
  at: string;
}

async function checkIdempotency(kind: string, key: string): Promise<string | null> {
  try {
    const txLog = await loadData<TransactionLogEntry[]>('txlog.json');
    if (!txLog) {
      return null;
    }
    
    const entry = txLog.find((entry: TransactionLogEntry) => entry.kind === kind && entry.key === key);
    return entry?.txHash || null;
  } catch {
    return null;
  }
}

async function logTransaction(kind: string, key: string, txHash: string) {
  try {
    let txLog: TransactionLogEntry[] = [];
    const existingLog = await loadData<TransactionLogEntry[]>('txlog.json');
    if (existingLog) {
      txLog = existingLog;
    }

    txLog.push({
      kind,
      key,
      txHash,
      at: new Date().toISOString()
    });

    await saveData('txlog.json', txLog);
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
      const existingTxHash = await checkIdempotency('issue', idempotencyKey);
      if (existingTxHash) {
        return NextResponse.json({
          ok: true,
          data: {
            txHash: existingTxHash,
            amount: issueAmount,
            currency: process.env.XRPL_CURRENCY_CODE,
            from: 'issuer',
            to: 'hot'
          }
        });
      }
    }

    // Load wallets from storage (Vercel Blob in production, local file in development)
    const walletsData = await loadData<WalletData>('wallets.json');
    if (!walletsData) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS_STORE' },
        { status: 500 }
      );
    }
    const issuerWallet = walletsData.wallets.find(w => w.role === 'issuer');
    const hotWallet = walletsData.wallets.find(w => w.role === 'hot');

    if (!issuerWallet || !hotWallet) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_WALLETS' },
        { status: 500 }
      );
    }

    // Environment variables
    const wsUrl = getWebSocketUrl();
    const sourceTag = Number(process.env.XRPL_SOURCE_TAG) || 0;
    const currencyCode = process.env.XRPL_CURRENCY_CODE;
    const minXrp = Number(process.env.XRPL_MIN_XRP) || 10;
    const requireAuth = process.env.XRPL_REQUIRE_AUTH === 'true';

    // Validate currency code
    if (!currencyCode) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_CURRENCY_CODE' },
        { status: 400 }
      );
    }

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
          await logTransaction('issue', idempotencyKey, txHash);
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
