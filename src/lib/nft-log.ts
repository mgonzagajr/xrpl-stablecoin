import fs from 'fs';
import path from 'path';

export interface NFTLogEntry {
  kind: 'mint' | 'offer_create' | 'offer_accept' | 'offer_cancel' | 'burn';
  key: string;
  nftokenId?: string;
  txHash?: string;
  uri?: string;
  transferable?: boolean;
  offerIndex?: string;
  amount?: string;
  at: string;
}

const NFT_LOG_PATH = path.join(process.cwd(), 'data', 'nftlog.json');

export function readNFTLog(): NFTLogEntry[] {
  try {
    if (!fs.existsSync(NFT_LOG_PATH)) {
      return [];
    }
    const data = fs.readFileSync(NFT_LOG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading NFT log:', error);
    return [];
  }
}

export function writeNFTLog(entries: NFTLogEntry[]): void {
  try {
    const dir = path.dirname(NFT_LOG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(NFT_LOG_PATH, JSON.stringify(entries, null, 2));
  } catch (error) {
    console.error('Error writing NFT log:', error);
  }
}

export function addNFTLogEntry(entry: Omit<NFTLogEntry, 'at'>): void {
  const entries = readNFTLog();
  const newEntry: NFTLogEntry = {
    ...entry,
    at: new Date().toISOString(),
  };
  entries.push(newEntry);
  writeNFTLog(entries);
}

export function findNFTLogEntry(kind: NFTLogEntry['kind'], key: string): NFTLogEntry | undefined {
  const entries = readNFTLog();
  return entries.find(entry => entry.kind === kind && entry.key === key);
}
