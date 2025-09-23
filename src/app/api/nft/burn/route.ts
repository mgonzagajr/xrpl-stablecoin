import { NextRequest, NextResponse } from 'next/server';
import { Client, Wallet } from 'xrpl';
// Removed fs import
// Removed path import
import { ensureFunded } from '@/lib/xrpl-helpers';
import { addNFTLogEntry, findNFTLogEntry } from '@/lib/nft-log';
import { loadData } from '@/lib/vercel-storage';
import { getWebSocketUrl } from '@/lib/network-config';
import { WalletData } from '@/types/wallet';

interface BurnRequest {
  nftokenId: string;
  role?: 'seller' | 'buyer';
  idempotencyKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BurnRequest = await request.json();
    const { nftokenId, role = 'seller', idempotencyKey } = body;

    // Validate input
    if (!nftokenId) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_NFTOKEN_ID', details: 'NFTokenID cannot be empty' },
        { status: 400 }
      );
    }

    if (role !== 'seller' && role !== 'buyer') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_ROLE', details: 'Role must be either seller or buyer' },
        { status: 400 }
      );
    }

    // Load wallets from storage (Vercel Blob in production, local file in development)
    const wallets = await loadData<WalletData>('wallets.json');
    if (!wallets) {
      return NextResponse.json(
        { ok: false, error: 'WALLETS_NOT_FOUND' },
        { status: 400 }
      );
    }
    const walletData = wallets.wallets.find(w => w.role === role);

    if (!walletData) {
      return NextResponse.json(
        { ok: false, error: `${role.toUpperCase()}_WALLET_NOT_FOUND` },
        { status: 400 }
      );
    }

    // Check for idempotency
    if (idempotencyKey) {
      const existingEntry = findNFTLogEntry('burn', idempotencyKey);
      if (existingEntry) {
        console.log(`Idempotent burn request for key ${idempotencyKey}. Returning previous result.`);
        return NextResponse.json({
          ok: true,
          data: {
            nftokenId: existingEntry.nftokenId!,
            txHash: existingEntry.txHash!,
          },
        });
      }
    }

    // Connect to XRPL
    const wsUrl = getWebSocketUrl();
    const client = new Client(wsUrl);
    await client.connect();

    try {
      // Ensure wallet is funded
      const wallet = Wallet.fromSeed(walletData.seed);
      const fundingResult = await ensureFunded(client, wallet, Number(process.env.XRPL_MIN_XRP) || 20);
      if (fundingResult.status === 'error') {
        return NextResponse.json(
          { ok: false, error: 'INSUFFICIENT_XRP_RESERVE', details: fundingResult.errorCode },
          { status: 400 }
        );
      }

      // Verify the NFT exists and is owned by the wallet
      const accountNFTs = await client.request({
        command: 'account_nfts',
        account: walletData.address,
        ledger_index: 'validated'
      });

      const nftExists = accountNFTs.result.account_nfts.some((nft: { NFTokenID: string }) => 
        nft.NFTokenID === nftokenId
      );

      if (!nftExists) {
        return NextResponse.json(
          { ok: false, error: 'NFT_NOT_FOUND', details: `NFT not found in ${role} account` },
          { status: 400 }
        );
      }

      // Prepare NFTokenBurn transaction
      const burnTransaction = {
        TransactionType: 'NFTokenBurn' as const,
        Account: walletData.address,
        NFTokenID: nftokenId,
        SourceTag: wallets.sourceTag,
      };

      console.log('Burning NFT with transaction:', JSON.stringify(burnTransaction, null, 2));

      // Submit transaction - use submitAndWait for Mainnet reliability
      let response;
      let txHash;
      
      if (process.env.XRPL_NETWORK === 'MAINNET') {
        // Use submitAndWait for Mainnet - more reliable
        const prepared = await client.autofill(burnTransaction);
        const signed = wallet.sign(prepared);
        response = await client.submitAndWait(signed.tx_blob);
        txHash = response.result.hash;
        console.log('Mainnet burn transaction submitted and validated:', txHash);
      } else {
        // Use regular submit for Testnet
        response = await client.submit(burnTransaction, { wallet });
        console.log('NFT burn response:', JSON.stringify(response.result, null, 2));
        
        if (response.result.engine_result !== 'tesSUCCESS') {
          return NextResponse.json(
            { ok: false, error: 'XRPL_REQUEST_FAILED', details: response.result.engine_result_message },
            { status: 400 }
          );
        }
        txHash = response.result.tx_json.hash;
      }


      // Log the burn operation
      if (idempotencyKey) {
        addNFTLogEntry({
          kind: 'burn',
          key: idempotencyKey,
          txHash,
          nftokenId,
        });
      }

      return NextResponse.json({
        ok: true,
        data: {
          nftokenId,
          txHash,
        },
      });

    } catch (error: unknown) {
      console.error('Error burning NFT:', error);
      return NextResponse.json(
        { ok: false, error: 'XRPL_REQUEST_FAILED', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    } finally {
      await client.disconnect();
    }
  } catch (error: unknown) {
    console.error('Error in NFT burn API:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
