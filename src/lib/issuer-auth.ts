import { Client, Wallet } from 'xrpl';

export interface IssuerAuthResult {
  status: 'ok' | 'authorized' | 'error';
  errorCode?: string;
  txHash?: string;
}

/**
 * Ensures the issuer has authorized a trust line from the holder
 * Only used when XRPL_REQUIRE_AUTH=true
 */
export async function ensureIssuerAuthorization(
  client: Client,
  issuerWallet: Wallet,
  holderAddress: string,
  currencyCode: string,
  sourceTag: number
): Promise<IssuerAuthResult> {
  try {
    // Check if the holder's trust line to issuer is already authorized
    const accountLines = await client.request({
      command: 'account_lines',
      account: holderAddress,
      ledger_index: 'validated'
    });

    const issuerAddress = issuerWallet.address;
    const trustLine = accountLines.result.lines.find((line: { account: string; currency: string; authorized?: boolean }) => 
      line.account === issuerAddress && line.currency === currencyCode
    );

    if (!trustLine) {
      return {
        status: 'error',
        errorCode: 'MISSING_TRUSTLINE'
      };
    }

    // Check if already authorized
    if (trustLine.authorized === true) {
      return {
        status: 'ok'
      };
    }

    // Need to authorize - submit TrustSet from issuer with tfSetAuth
    console.log(`Authorizing trust line from ${holderAddress} to ${issuerAddress} for ${currencyCode}`);
    
    const trustSetTx = {
      TransactionType: 'TrustSet' as const,
      Account: issuerAddress,
      LimitAmount: {
        currency: currencyCode,
        issuer: holderAddress,
        value: '0' // Set to 0 since we're only authorizing
      },
      Flags: 0x00010000, // tfSetAuth
      SourceTag: sourceTag
    };

    const prepared = await client.autofill(trustSetTx);
    const signed = issuerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if ((result.result.meta as { TransactionResult?: string })?.TransactionResult === 'tesSUCCESS') {
      console.log(`Successfully authorized trust line: ${result.result.hash}`);
      return {
        status: 'authorized',
        txHash: result.result.hash
      };
    } else {
      console.error('TrustSet authorization failed:', (result.result.meta as { TransactionResult?: string })?.TransactionResult);
      return {
        status: 'error',
        errorCode: 'AUTHORIZATION_FAILED'
      };
    }

  } catch (error) {
    console.error('Error in ensureIssuerAuthorization:', error);
    return {
      status: 'error',
      errorCode: 'XRPL_REQUEST_FAILED'
    };
  }
}
