import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'xrpl';
import fs from 'fs';
import path from 'path';
import { WalletData } from '@/types/wallet';

interface NFTOfferExtended {
  nft_offer_index: string;
  NFTokenID: string;
  amount: string;
}

interface NFTAccountOffer {
  index: string;
  NFTokenID: string;
  Amount: string | { value: string; currency: string; issuer: string };
  Flags: number;
}


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seller = searchParams.get('seller');
    const buyer = searchParams.get('buyer');
    const nftokenId = searchParams.get('nftokenId');

    if (!seller && !buyer) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_ROLE_PARAMETER' },
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

    // Connect to XRPL
    const client = new Client(process.env.XRPL_WS_URL!);
    await client.connect();

    try {
      const offers: Array<{ offerIndex: string; nftokenId: string; amount: string }> = [];

      // Get seller offers
      if (seller === '1') {
        if (nftokenId) {
          // Get offers for specific NFT
          const sellOffers = await client.request({
            command: 'nft_sell_offers',
            nft_id: nftokenId,
          });

          if (sellOffers.result.offers) {
            for (const offer of sellOffers.result.offers) {
              offers.push({
                offerIndex: offer.nft_offer_index,
                nftokenId: (offer as unknown as NFTOfferExtended).NFTokenID,
                amount: offer.amount.toString(),
              });
            }
          }
        } else {
          // Get all offers for seller using account_objects
          const sellerWallet = wallets.wallets.find(w => w.role === 'seller');
          if (!sellerWallet) {
            return NextResponse.json(
              { ok: false, error: 'SELLER_WALLET_NOT_FOUND' },
              { status: 400 }
            );
          }

          const accountObjects = await client.request({
            command: 'account_objects',
            account: sellerWallet.address,
            type: 'nft_offer',
            ledger_index: 'validated'
          });

          if (accountObjects.result.account_objects) {
            for (const offer of accountObjects.result.account_objects) {
              // Type guard to check if it's an NFT offer
              if ('NFTokenID' in offer && 'Amount' in offer && 'index' in offer) {
                const nftOffer = offer as NFTAccountOffer;
                if (nftOffer.Flags === 1) { // tfSellNFToken
                  offers.push({
                    offerIndex: nftOffer.index,
                    nftokenId: nftOffer.NFTokenID,
                    amount: typeof nftOffer.Amount === 'string' ? nftOffer.Amount : nftOffer.Amount.value,
                  });
                }
              }
            }
          }
        }
      }

      // Get buyer offers
      if (buyer === '1') {
        if (nftokenId) {
          const buyOffers = await client.request({
            command: 'nft_buy_offers',
            nft_id: nftokenId,
          });

          if (buyOffers.result.offers) {
            for (const offer of buyOffers.result.offers) {
              offers.push({
                offerIndex: offer.nft_offer_index,
                nftokenId: (offer as unknown as NFTOfferExtended).NFTokenID,
                amount: offer.amount.toString(),
              });
            }
          }
        }
      }

      return NextResponse.json({
        ok: true,
        data: {
          offers,
        },
      });

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('NFT offer list error:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
