/**
 * Utility functions for fetching and processing XRPL transactions
 */

import { getXrplApiUrl } from '@/lib/network-config';

interface XRPLTransactionData {
  TransactionType: string;
  Account: string;
  Destination?: string;
  Amount?: string | { value: string; currency: string; issuer: string };
  Fee: string;
  date: number; // XRPL date is a Ripple epoch
  hash: string;
  SourceTag?: number;
  meta?: { 
    TransactionResult?: string; 
    AffectedNodes?: Array<{
      DeletedNode?: {
        FinalFields?: {
          Amount?: { value: string; currency: string; issuer: string };
        };
      };
    }>;
  };
  [key: string]: unknown;
}

export interface TransactionData {
  hash: string;
  wallet: string;
  walletRole: string;
  type: string;
  sbrAmount?: string;
  date: string;
  fee: string;
  destination?: string;
}

export interface TransactionStats {
  totalTransactions: number;
  totalVolume: number;
  transactions: TransactionData[];
}

/**
 * Fetch all transactions with source tag from all wallets
 * @param wallets - Array of wallet objects with role, address, seed
 * @param currencyCode - Currency code to filter (e.g., 'SBR')
 * @param sourceTag - Source tag to filter transactions
 * @param includeVolume - Whether to calculate volume (for performance)
 * @returns Promise<TransactionStats>
 */
export async function fetchTransactionsWithSourceTag(
  wallets: Array<{ role: string; address: string; seed: string }>,
  currencyCode: string,
  sourceTag: string,
  includeVolume: boolean = true
): Promise<TransactionStats> {
  const transactions: TransactionData[] = [];
  const seenHashes = new Set<string>(); // Track seen transaction hashes
  let totalVolume = 0;

  // Create wallet role mapping
  const walletRoles: { [key: string]: string } = {};
  wallets.forEach(wallet => {
    walletRoles[wallet.address] = wallet.role;
  });

  // Fetch transactions from all wallets
  for (const wallet of wallets) {
    try {
      const accountTxResponse = await fetch(getXrplApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'account_tx',
          params: [{
            account: wallet.address,
            ledger_index_min: -1,
            ledger_index_max: -1,
            limit: 100, // Fetch more transactions to ensure we get enough with the source tag
            forward: false
          }]
        })
      });

      const accountTxData = await accountTxResponse.json();

      if (accountTxData.result && accountTxData.result.transactions) {
        for (const tx of accountTxData.result.transactions) {
          const txData = (tx.tx || tx) as unknown as XRPLTransactionData;
          const meta = (tx.meta || {}) as XRPLTransactionData['meta'];

          // Check if transaction has the source tag and is successful
          if (txData.SourceTag && 
              txData.SourceTag.toString() === sourceTag &&
              meta?.TransactionResult === 'tesSUCCESS' &&
              !seenHashes.has(txData.hash)) {
            
            // Mark this hash as seen to avoid duplicates
            seenHashes.add(txData.hash);
            
            let sbrAmount: string | undefined;
            
            // Extract SBR amount from various transaction types
            if (txData.TransactionType === 'Payment' &&
                txData.Amount &&
                typeof txData.Amount === 'object' &&
                'currency' in txData.Amount &&
                txData.Amount.currency === currencyCode) {
              sbrAmount = txData.Amount.value as string;
              
              // Calculate volume if requested
              if (includeVolume) {
                const amount = parseFloat(txData.Amount.value);
                totalVolume += amount;
              }
            }
            
            // Check for SBR in NFTokenAcceptOffer (in AffectedNodes)
            if (txData.TransactionType === 'NFTokenAcceptOffer' && meta?.AffectedNodes) {
              for (const node of meta.AffectedNodes) {
                if (node.DeletedNode && 
                    node.DeletedNode.FinalFields && 
                    node.DeletedNode.FinalFields.Amount &&
                    typeof node.DeletedNode.FinalFields.Amount === 'object' &&
                    'currency' in node.DeletedNode.FinalFields.Amount &&
                    node.DeletedNode.FinalFields.Amount.currency === currencyCode) {
                  sbrAmount = node.DeletedNode.FinalFields.Amount.value as string;
                  
                  // Calculate volume if requested
                  if (includeVolume) {
                    const amount = parseFloat(node.DeletedNode.FinalFields.Amount.value);
                    totalVolume += amount;
                  }
                  break;
                }
              }
            }
            
            // Check for SBR in other transaction types that might have Amount field
            if (!sbrAmount && txData.Amount &&
                typeof txData.Amount === 'object' &&
                'currency' in txData.Amount &&
                txData.Amount.currency === currencyCode) {
              sbrAmount = txData.Amount.value as string;
              
              // Calculate volume if requested
              if (includeVolume) {
                const amount = parseFloat(txData.Amount.value);
                totalVolume += amount;
              }
            }

            // Convert XRPL date to ISO string
            const xrplEpoch = 946684800; // January 1, 2000, 00:00:00 UTC
            const date = new Date((txData.date + xrplEpoch) * 1000);

            // Convert fee from drops to XRP (1 XRP = 1,000,000 drops)
            const feeInXRP = (parseInt(txData.Fee) / 1000000).toFixed(6);

            transactions.push({
              hash: txData.hash,
              wallet: txData.Account,
              walletRole: walletRoles[txData.Account] || 'unknown',
              type: txData.TransactionType,
              sbrAmount: sbrAmount,
              date: date.toISOString(),
              fee: feeInXRP,
              destination: txData.Destination
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch transactions for wallet ${wallet.address}:`, error);
    }
  }

  // Sort transactions by date, newest first
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    totalTransactions: transactions.length,
    totalVolume,
    transactions
  };
}

