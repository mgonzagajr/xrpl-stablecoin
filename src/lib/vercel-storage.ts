import { put, del, list } from '@vercel/blob';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Helper para detectar se estamos em produção (Vercel) ou desenvolvimento local
const isProduction = process.env.NODE_ENV === 'production';

// Função para salvar dados
export async function saveData(filename: string, data: unknown): Promise<void> {
  const jsonData = JSON.stringify(data, null, 2);
  
  if (isProduction) {
    // Em produção: usar Vercel Blob
    await put(filename, jsonData, {
      access: 'public',
      contentType: 'application/json',
    });
  } else {
    // Em desenvolvimento: usar sistema de arquivos local
    const filePath = join(process.cwd(), 'data', filename);
    writeFileSync(filePath, jsonData);
  }
}

// Função para carregar dados
export async function loadData<T>(filename: string): Promise<T | null> {
  try {
    if (isProduction) {
      // Em produção: usar Vercel Blob
      const response = await fetch(`https://blob.vercel-storage.com/${filename}`);
      if (!response.ok) {
        return null;
      }
      const jsonData = await response.text();
      return JSON.parse(jsonData);
    } else {
      // Em desenvolvimento: usar sistema de arquivos local
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

// Função para deletar dados
export async function deleteData(filename: string): Promise<void> {
  if (isProduction) {
    // Em produção: usar Vercel Blob
    await del(filename);
  } else {
    // Em desenvolvimento: usar sistema de arquivos local
    const filePath = join(process.cwd(), 'data', filename);
    if (existsSync(filePath)) {
      const fs = await import('fs');
      fs.unlinkSync(filePath);
    }
  }
}

// Função para listar arquivos
export async function listData(): Promise<string[]> {
  if (isProduction) {
    // Em produção: usar Vercel Blob
    const { blobs } = await list();
    return blobs.map(blob => blob.pathname);
  } else {
    // Em desenvolvimento: usar sistema de arquivos local
    const fs = await import('fs');
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      return [];
    }
    return fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
  }
}
