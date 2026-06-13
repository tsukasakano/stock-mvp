import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);

export type DataStatusResponse = {
  updatedAt: string | null;
  success: boolean | null;
};

const LAST_UPDATED_PATH = path.join(process.cwd(), 'public', 'data', 'last_updated.json');

function readLastUpdated(): DataStatusResponse {
  if (!existsSync(LAST_UPDATED_PATH)) {
    return { updatedAt: null, success: null };
  }
  try {
    const raw = readFileSync(LAST_UPDATED_PATH, 'utf-8');
    return JSON.parse(raw) as DataStatusResponse;
  } catch {
    return { updatedAt: null, success: null };
  }
}

export async function GET(): Promise<NextResponse<DataStatusResponse>> {
  return NextResponse.json(readLastUpdated());
}

export async function POST(): Promise<NextResponse<DataStatusResponse | { error: string; updatedAt: null }>> {
  try {
    await execAsync('python3 scripts/auto_update.py', {
      cwd: process.cwd(),
      timeout: 300_000,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, updatedAt: null },
      { status: 500 }
    );
  }

  return NextResponse.json(readLastUpdated());
}
