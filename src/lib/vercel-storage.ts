import { put, del, list } from '@vercel/blob';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Helper to detect if running in production (Vercel) or local development
const isProduction = process.env.NODE_ENV === 'production';

// Function to save data
export async function saveData(filename: string, data: unknown): Promise<void> {
  const jsonData = JSON.stringify(data, null, 2);
  
  if (isProduction) {
    // In production: use Vercel Blob
    await put(filename, jsonData, {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true, // Permitir sobrescrita de arquivos existentes
    });
  } else {
    // In desenvolvimento: use local file system
    const filePath = join(process.cwd(), 'data', filename);
    const dataDir = dirname(filePath);
    
    // Create directory if it does not exist
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    writeFileSync(filePath, jsonData);
  }
}

// Function to load data
export async function loadData<T>(filename: string): Promise<T | null> {
  try {
    if (isProduction) {
      // In production: use Vercel Blob
      try {
        const { list } = await import('@vercel/blob');
        const { blobs } = await list();
        const targetBlob = blobs.find(blob => blob.pathname === filename);
        
        if (!targetBlob) {
          console.log(`Blob ${filename} not found in Vercel Blob storage`);
          return null;
        }
        
        const response = await fetch(targetBlob.url);
        if (!response.ok) {
          console.error(`Failed to fetch blob ${filename}: ${response.status}`);
          return null;
        }
        
        const jsonData = await response.text();
        return JSON.parse(jsonData);
      } catch (blobError) {
        console.error('Vercel Blob error:', blobError);
        return null;
      }
    } else {
      // In desenvolvimento: use local file system
      const filePath = join(process.cwd(), 'data', filename);
      if (!existsSync(filePath)) {
        return null;
      }
      const jsonData = readFileSync(filePath, 'utf-8');
      return JSON.parse(jsonData);
    }
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return null;
  }
}

// Function to delete data
export async function deleteData(filename: string): Promise<void> {
  if (isProduction) {
    // In production: use Vercel Blob
    await del(filename);
  } else {
    // In desenvolvimento: use local file system
    const filePath = join(process.cwd(), 'data', filename);
    if (existsSync(filePath)) {
      const fs = await import('fs');
      fs.unlinkSync(filePath);
    }
  }
}

// Function to list files
export async function listData(): Promise<string[]> {
  if (isProduction) {
    // In production: use Vercel Blob
    const { blobs } = await list();
    return blobs.map(blob => blob.pathname);
  } else {
    // In desenvolvimento: use local file system
    const fs = await import('fs');
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      return [];
    }
    return fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
  }
}
