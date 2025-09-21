import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IDEMPOTENCY_LOG_PATH = path.join(process.cwd(), 'data', 'idempotency.json');

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

    // Read existing data
    let data: IdempotencyData = { entries: [] };
    if (fs.existsSync(IDEMPOTENCY_LOG_PATH)) {
      const fileContent = fs.readFileSync(IDEMPOTENCY_LOG_PATH, 'utf8');
      data = JSON.parse(fileContent);
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
    const dir = path.dirname(IDEMPOTENCY_LOG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(IDEMPOTENCY_LOG_PATH, JSON.stringify(data, null, 2));

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
