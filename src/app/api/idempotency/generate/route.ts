import { NextRequest, NextResponse } from 'next/server';
import { loadData, saveData } from '@/lib/vercel-storage';

interface IdempotencyEntry {
  prefix: string;
  lastId: number;
  at: string;
}

interface IdempotencyData {
  entries: IdempotencyEntry[];
}

export async function POST(request: NextRequest) {
  try {
    const { prefix } = await request.json();

    if (!prefix || typeof prefix !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_PREFIX', details: 'Prefix is required' },
        { status: 400 }
      );
    }

    // Load existing data
    let data: IdempotencyData = { entries: [] };
    const existingData = await loadData<IdempotencyData>('idempotency.json');
    if (existingData) {
      data = existingData;
    }

    // Find existing entry for this prefix
    let existingEntry = data.entries.find(entry => entry.prefix === prefix);
    
    if (existingEntry) {
      // Increment the last ID
      existingEntry.lastId += 1;
      existingEntry.at = new Date().toISOString();
    } else {
      // Create new entry starting from 1
      existingEntry = {
        prefix,
        lastId: 1,
        at: new Date().toISOString()
      };
      data.entries.push(existingEntry);
    }

    // Save updated data
    await saveData('idempotency.json', data);

    // Return the generated key
    const key = `${prefix}-${existingEntry.lastId.toString().padStart(3, '0')}`;
    
    return NextResponse.json({
      ok: true,
      data: {
        key,
        prefix,
        id: existingEntry.lastId
      }
    });

  } catch (error) {
    console.error('Error generating idempotency key:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
