import { Client, Wallet } from 'xrpl';

export interface EnsureFundedResult {
  status: 'ok' | 'funded' | 'error';
  errorCode?: string;
  address: string;
  balanceXrp?: number;
}

export async function ensureFunded(
  client: Client,
  wallet: Wallet,
  minXrp: number
): Promise<EnsureFundedResult> {
  const address = wallet.address;
  
  try {
    // Check current balance
    const accountInfo = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    const balanceDrops = Number(accountInfo.result.account_data.Balance);
    const balanceXrp = balanceDrops / 1000000; // Convert drops to XRP

    if (balanceXrp >= minXrp) {
      return {
        status: 'ok',
        address,
        balanceXrp
      };
    }

    // Account exists but insufficient balance
    const network = process.env.XRPL_NETWORK || 'TESTNET';
    const autoFaucet = process.env.XRPL_AUTO_FAUCET === 'true';

    if (network === 'TESTNET' && autoFaucet) {
      console.log(`Account ${address} exists but has insufficient balance (${balanceXrp} XRP < ${minXrp} XRP)`);
      console.log(`Note: XRPL.js fundWallet() only creates NEW accounts, it cannot fund existing accounts.`);
      console.log(`Please manually fund account ${address} with at least ${minXrp} XRP using:`);
      console.log(`- XRPL Testnet Faucet: https://xrpl.org/xrp-testnet-faucet.html`);
      console.log(`- Or send XRP from another account`);
      
      return {
        status: 'error',
        errorCode: 'INSUFFICIENT_BALANCE',
        address
      };
    } else {
      // MAINNET or faucet disabled
      return {
        status: 'error',
        errorCode: 'INSUFFICIENT_BALANCE',
        address
      };
    }

  } catch (accountError: unknown) {
    // Account doesn't exist
    if ((accountError as { data?: { error?: string } })?.data?.error === 'actNotFound') {
      const network = process.env.XRPL_NETWORK || 'TESTNET';
      const autoFaucet = process.env.XRPL_AUTO_FAUCET === 'true';

      if (network === 'TESTNET' && autoFaucet) {
        try {
          console.log(`Account ${address} does not exist. Creating new account via faucet...`);
          // Fund the wallet to create account
          const fundingResult = await client.fundWallet();
          console.log('New account created:', fundingResult);
          
          // Wait and retry with backoff (up to 3 retries, 1s apart)
          for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`Retry attempt ${attempt} for new account ${address}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            
            const retryAccountInfo = await client.request({
              command: 'account_info',
              account: address,
              ledger_index: 'validated'
            });
            
            const retryBalanceDrops = Number(retryAccountInfo.result.account_data.Balance);
            const retryBalanceXrp = retryBalanceDrops / 1000000;
            
            console.log(`Retry ${attempt}: New account ${address} balance: ${retryBalanceXrp} XRP`);
            
            if (retryBalanceXrp >= minXrp) {
              return {
                status: 'funded',
                address,
                balanceXrp: retryBalanceXrp
              };
            }
          }
          
          // Still insufficient after retries
          return {
            status: 'error',
            errorCode: 'INSUFFICIENT_BALANCE',
            address
          };
          
        } catch (fundError) {
          console.error('Faucet funding failed:', fundError);
          return {
            status: 'error',
            errorCode: 'INSUFFICIENT_BALANCE',
            address
          };
        }
      } else {
        // MAINNET or faucet disabled
        return {
          status: 'error',
          errorCode: 'INSUFFICIENT_BALANCE',
          address
        };
      }
    } else {
      // Other error
      console.error('Account info error:', accountError);
      return {
        status: 'error',
        errorCode: 'INSUFFICIENT_BALANCE',
        address
      };
    }
  }
}
