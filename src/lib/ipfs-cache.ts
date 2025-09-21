// IPFS Metadata Cache using localStorage
const CACHE_KEY = 'ipfs_metadata_cache';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: unknown;
  timestamp: number;
  uri: string;
}

interface IPFSCache {
  [nftokenId: string]: CacheEntry;
}

export function getCachedMetadata(nftokenId: string): unknown | null {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    if (!cacheStr) return null;

    const cache: IPFSCache = JSON.parse(cacheStr);
    const entry = cache[nftokenId];
    
    if (!entry) return null;

    // Check if cache is expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_EXPIRY_MS) {
      // Remove expired entry
      delete cache[nftokenId];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('Error reading IPFS cache:', error);
    return null;
  }
}

export function setCachedMetadata(nftokenId: string, uri: string, data: unknown): void {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    const cache: IPFSCache = cacheStr ? JSON.parse(cacheStr) : {};

    cache[nftokenId] = {
      data,
      timestamp: Date.now(),
      uri
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error writing IPFS cache:', error);
  }
}

export function clearExpiredCache(): void {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    if (!cacheStr) return;

    const cache: IPFSCache = JSON.parse(cacheStr);
    const now = Date.now();
    let hasChanges = false;

    for (const [nftokenId, entry] of Object.entries(cache)) {
      if (now - entry.timestamp > CACHE_EXPIRY_MS) {
        delete cache[nftokenId];
        hasChanges = true;
      }
    }

    if (hasChanges) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.error('Error clearing expired cache:', error);
  }
}

export function clearAllCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}
