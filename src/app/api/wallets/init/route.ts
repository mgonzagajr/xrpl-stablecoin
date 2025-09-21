import { NextResponse } from 'next/server';
import { Client, Wallet as XrplWallet } from 'xrpl';
import { promises as fs } from 'fs';
import path from 'path';
import { WalletData, ApiResponse, WalletsApiData } from '@/types/wallet';

// POC storage - NOT production grade secret management
const WALLETS_FILE_PATH = path.join(process.cwd(), 'data', 'wallets.json');

function validateEnvironment(): { isValid: boolean; error?: string } {
  const wsUrl = process.env.XRPL_WS_URL;
  const network = process.env.XRPL_NETWORK;
  const sourceTag = process.env.XRPL_SOURCE_TAG;

  if (!wsUrl) {
    return { isValid: false, error: 'XRPL_WS_URL environment variable is required' };
  }

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
  const client = new Client(process.env.XRPL_WS_URL!);
  
  try {
    await client.connect();
    
    const roles: Array<'issuer' | 'hot' | 'seller' | 'buyer'> = ['issuer', 'hot', 'seller', 'buyer'];
    const network = process.env.XRPL_NETWORK as 'TESTNET' | 'MAINNET';
    const autoFaucet = process.env.XRPL_AUTO_FAUCET === 'true';
    
    const wallets = await Promise.all(
      roles.map(async (role) => {
        // Auto-faucet for TESTNET - create funded wallet directly
        if (network === 'TESTNET' && autoFaucet) {
          try {
            console.log(`Auto-funding ${role} wallet...`);
            const fundingResult = await client.fundWallet();
            console.log(`Auto-funded ${role} wallet:`, {
              address: fundingResult.wallet.address,
              balance: fundingResult.balance
            });
            
            // Use the funded wallet
            return {
              role,
              address: fundingResult.wallet.address,
              publicKey: fundingResult.wallet.publicKey,
              privateKey: fundingResult.wallet.privateKey,
              seed: fundingResult.wallet.seed!
            };
          } catch (fundError) {
            console.warn(`Failed to auto-fund ${role} wallet:`, fundError);
            // Fallback to regular wallet generation
            const wallet = XrplWallet.generate();
            return {
              role,
              address: wallet.address,
              publicKey: wallet.publicKey,
              privateKey: wallet.privateKey,
              seed: wallet.seed!
            };
          }
        } else {
          // Regular wallet generation (MAINNET or faucet disabled)
          const wallet = XrplWallet.generate();
          return {
            role,
            address: wallet.address,
            publicKey: wallet.publicKey,
            privateKey: wallet.privateKey,
            seed: wallet.seed!
          };
        }
      })
    );

    const walletData: WalletData = {
      version: 1,
      createdAt: new Date().toISOString(),
      network,
      sourceTag: parseInt(process.env.XRPL_SOURCE_TAG!, 10),
      wallets
    };

    return walletData;
  } finally {
    await client.disconnect();
  }
}

async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(WALLETS_FILE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

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
    try {
      const existingData = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
      const wallets: WalletData = JSON.parse(existingData);
      
      // Return existing wallets without secrets
      const response: WalletsApiData = {
        network: wallets.network,
        sourceTag: wallets.sourceTag,
        wallets: wallets.wallets.map(w => ({ role: w.role, address: w.address }))
      };

      return NextResponse.json({
        ok: true,
        created: false,
        data: response
      });
    } catch {
      // File doesn't exist, generate new wallets
    }

    // Generate new wallets
    const walletData = await generateWallets();
    
    // Ensure data directory exists
    await ensureDataDirectory();
    
    // Write wallets to file (secrets stored server-side only)
    await fs.writeFile(WALLETS_FILE_PATH, JSON.stringify(walletData, null, 2));

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
    return NextResponse.json(
      { ok: false, error: 'Failed to initialize wallets' },
      { status: 500 }
    );
  }
}
