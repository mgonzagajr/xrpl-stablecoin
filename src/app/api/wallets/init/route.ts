import { NextResponse } from 'next/server';
import { Wallet as XrplWallet } from 'xrpl';
import { WalletData, ApiResponse, WalletsApiData } from '@/types/wallet';
import { saveData, loadData } from '@/lib/vercel-storage';
import { hasFaucet } from '@/lib/network-config';

function validateEnvironment(): { isValid: boolean; error?: string } {
  const network = process.env.XRPL_NETWORK;
  const sourceTag = process.env.XRPL_SOURCE_TAG;

  if (!network || !['TESTNET', 'MAINNET'].includes(network)) {
    return { isValid: false, error: 'XRPL_NETWORK must be either TESTNET or MAINNET' };
  }

  if (!sourceTag) {
    return { isValid: false, error: 'XRPL_SOURCE_TAG environment variable is required' };
  }

  const sourceTagNum = parseInt(sourceTag, 10);
  if (isNaN(sourceTagNum) || sourceTagNum < 0 || sourceTagNum > 4294967295) {
    return { isValid: false, error: 'XRPL_SOURCE_TAG must be a valid integer between 0 and 4294967295' };
  }

  return { isValid: true };
}

async function generateWallets(): Promise<WalletData> {
  const network = process.env.XRPL_NETWORK as 'TESTNET' | 'MAINNET';
  const autoFaucet = process.env.XRPL_AUTO_FAUCET === 'true' && hasFaucet();
  
  console.log(`Generating wallets for ${network} (auto-faucet: ${autoFaucet})`);
  
  const roles: Array<'issuer' | 'hot' | 'seller' | 'buyer'> = ['issuer', 'hot', 'seller', 'buyer'];
  
  // Generate wallets without connecting to XRPL
  // This is faster and works for both testnet and mainnet
  const wallets = roles.map((role) => {
    console.log(`Generating ${role} wallet...`);
    const wallet = XrplWallet.generate();
    return {
      role,
      address: wallet.address,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      seed: wallet.seed!
    };
  });

  const walletData: WalletData = {
    version: 1,
    createdAt: new Date().toISOString(),
    network,
    sourceTag: parseInt(process.env.XRPL_SOURCE_TAG!, 10),
    wallets
  };

  console.log('Wallets generated successfully:', {
    network,
    count: wallets.length,
    addresses: wallets.map(w => w.address)
  });

  return walletData;
}

// Função removida - não é mais necessária com Vercel Blob

export async function POST(): Promise<NextResponse<ApiResponse<WalletsApiData>>> {
  try {
    // Validate environment variables
    const envValidation = validateEnvironment();
    if (!envValidation.isValid) {
      return NextResponse.json(
        { ok: false, error: envValidation.error },
        { status: 500 }
      );
    }

    // Check if wallets already exist
    const existingWallets = await loadData<WalletData>('wallets.json');
    if (existingWallets) {
      // Check if the existing wallets are for the same network
      const currentNetwork = process.env.XRPL_NETWORK;
      if (existingWallets.network === currentNetwork) {
        // Return existing wallets without secrets
        const response: WalletsApiData = {
          network: existingWallets.network,
          sourceTag: existingWallets.sourceTag,
          wallets: existingWallets.wallets.map(w => ({ role: w.role, address: w.address }))
        };

        return NextResponse.json({
          ok: true,
          created: false,
          data: response
        });
      } else {
        // Different network, need to regenerate wallets
        console.log(`Network changed from ${existingWallets.network} to ${currentNetwork}, regenerating wallets...`);
      }
    }

    // Generate new wallets
    const walletData = await generateWallets();
    
    // Save wallets to storage (Vercel Blob in production, local file in development)
    await saveData('wallets.json', walletData);

    // Return wallets without secrets
    const response: WalletsApiData = {
      network: walletData.network,
      sourceTag: walletData.sourceTag,
      wallets: walletData.wallets.map(w => ({ role: w.role, address: w.address }))
    };

    return NextResponse.json({
      ok: true,
      created: true,
      data: response
    });

  } catch (error) {
    console.error('Error initializing wallets:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json(
      { ok: false, error: 'Failed to initialize wallets' },
      { status: 500 }
    );
  }
}
