import { NextRequest, NextResponse } from 'next/server';
import { fetchDailyQuotes } from '@/lib/jquants';
import { generateMockData } from '@/lib/mockData';
import { STOCKS } from '@/lib/stocks';

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  const stock = STOCKS.find(s => s.value === code);
  if (!stock) {
    return NextResponse.json({ error: 'unknown stock code' }, { status: 400 });
  }

  const from = new Date();
  from.setMonth(from.getMonth() - 6);

  try {
    // `to` を省略することでサブスクリプション内の最新日まで自動取得
    const data = await fetchDailyQuotes(code, dateStr(from));

    if (data.length === 0) {
      throw new Error('J-Quants returned empty dataset');
    }

    return NextResponse.json({ data, source: 'jquants' });
  } catch (error) {
    console.error('[stocks] J-Quants API error, falling back to mock:', error instanceof Error ? error.message : error);
    const data = generateMockData(stock);
    return NextResponse.json({ data, source: 'mock' });
  }
}
