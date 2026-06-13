import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const execAsync = promisify(exec);

export type DataStatusResponse = {
  updatedAt: string | null;
  success: boolean | null;
  skipped?: boolean;
  hoursAgo?: number;
  nextUpdateIn?: number;  // hours until next update is allowed
};

const LAST_UPDATED_PATH = path.join(process.cwd(), 'public', 'data', 'last_updated.json');
const COOLDOWN_HOURS = 6;

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

function hoursAgoFromUpdatedAt(updatedAt: string | null): number | null {
  if (!updatedAt) return null;
  const updated = new Date(updatedAt.replace(' ', 'T'));
  if (isNaN(updated.getTime())) return null;
  return (Date.now() - updated.getTime()) / (1000 * 60 * 60);
}

export async function GET(): Promise<NextResponse<DataStatusResponse>> {
  const status = readLastUpdated();
  const hours = hoursAgoFromUpdatedAt(status.updatedAt);
  if (hours !== null) {
    const nextIn = Math.max(0, COOLDOWN_HOURS - hours);
    return NextResponse.json({
      ...status,
      hoursAgo: parseFloat(hours.toFixed(1)),
      nextUpdateIn: parseFloat(nextIn.toFixed(1)),
    });
  }
  return NextResponse.json(status);
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<DataStatusResponse | { error: string; updatedAt: null }>> {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  // クールダウンチェック（force=true の場合はスキップ）
  if (!force) {
    const current = readLastUpdated();
    const hours = hoursAgoFromUpdatedAt(current.updatedAt);
    if (hours !== null && hours < COOLDOWN_HOURS) {
      const nextIn = COOLDOWN_HOURS - hours;
      return NextResponse.json({
        ...current,
        skipped: true,
        hoursAgo: parseFloat(hours.toFixed(1)),
        nextUpdateIn: parseFloat(nextIn.toFixed(1)),
      });
    }
  }

  try {
    await execAsync('python3 scripts/auto_update.py', {
      cwd: process.cwd(),
      timeout: 300_000,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, updatedAt: null },
      { status: 500 },
    );
  }

  const status = readLastUpdated();
  const hours = hoursAgoFromUpdatedAt(status.updatedAt);
  return NextResponse.json({
    ...status,
    hoursAgo: hours !== null ? parseFloat(hours.toFixed(1)) : undefined,
    nextUpdateIn: hours !== null ? parseFloat(Math.max(0, COOLDOWN_HOURS - hours).toFixed(1)) : undefined,
  });
}
