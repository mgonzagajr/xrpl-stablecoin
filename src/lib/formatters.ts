/**
 * Utility functions for formatting data in the frontend
 */

/**
 * Format a number with thousands separators
 * @param value - The number to format (string or number)
 * @returns Formatted string with commas
 */
export function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US');
}

/**
 * Format SBR balance with thousands separators
 * @param balance - SBR balance as string
 * @returns Formatted SBR balance
 */
export function formatSbrBalance(balance: string): string {
  return formatNumber(balance);
}

/**
 * Format XRP balance with 6 decimal places
 * @param balance - XRP balance as number
 * @returns Formatted XRP balance
 */
export function formatXrpBalance(balance: number): string {
  return balance.toFixed(6);
}

/**
 * Format currency with proper symbol and thousands separators
 * @param value - The value to format as string
 * @param currency - Currency code (BRL, USD, etc.)
 * @returns Formatted currency string
 */
export function formatCurrency(value: string, currency: string): string {
  const num = parseFloat(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Format currency amount without symbol, just number + currency code
 * @param value - The value to format as string
 * @param currency - Currency code (USD, BRL, etc.)
 * @returns Formatted amount with currency code
 */
export function formatCurrencyAmount(value: string, currency: string): string {
  const num = parseFloat(value);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
  return `${formatted} ${currency}`;
}
