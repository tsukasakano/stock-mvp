import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { fetchDailyQuotes } from '@/lib/jquants';
import { generateMockData } from '@/lib/mockData';
import { ALL_STOCKS } from '@/lib/stocks';

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  const stock = ALL_STOCKS.find(s => s.value === code);
  if (!stock) {
    return NextResponse.json({ error: 'unknown stock code' }, { status: 400 });
  }

  // 1) yfinanceキャッシュを最優先（ローカルJSONが存在すれば常に使用）
  const histPath = path.join(
    process.cwd(), 'public', 'data', 'historical', `${code}.T.json`,
  );
  if (existsSync(histPath)) {
    try {
      const raw = JSON.parse(readFileSync(histPath, 'utf-8')) as {
        date: string; open: number; high: number; low: number; close: number; volume: number;
      }[];
      if (raw.length > 0) {
        // チャート表示用に直近180取引日分を返す
        const recent = raw.slice(-180);
        return NextResponse.json({ data: recent, source: 'yfinance' });
      }
    } catch (e) {
      console.error('[stocks] yfinance cache read error:', e);
    }
  }

  // 2) J-Quantsにフォールバック（yfinanceキャッシュがない場合のみ）
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  try {
    const data = await fetchDailyQuotes(code, dateStr(from));
    if (data.length > 0) {
      return NextResponse.json({ data, source: 'jquants' });
    }
    throw new Error('J-Quants returned empty dataset');
  } catch (error) {
    console.error('[stocks] J-Quants error:', error instanceof Error ? error.message : error);
  }

  // 3) モックデータで最終フォールバック
  const data = generateMockData(stock);
  return NextResponse.json({ data, source: 'mock' });
}
