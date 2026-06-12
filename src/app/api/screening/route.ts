import { readFileSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export type ScreeningCandidate = {
  symbol: string;
  name: string;
  score: number;
  price: number;
  rsi: number;
  macd: number;
  volume_ratio: number;
  signals: string[];
};

export type ScreeningResult = {
  updatedAt: string;
  candidates: ScreeningCandidate[];
  stale?: boolean;
};

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'screening_result.json');
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as ScreeningResult;

    const today = new Date().toISOString().split('T')[0];
    const stale = data.updatedAt < today;

    return NextResponse.json({ ...data, stale });
  } catch {
    return NextResponse.json({ error: 'Screening data not found' }, { status: 404 });
  }
}
