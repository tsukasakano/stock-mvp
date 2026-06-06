import type { StockData } from '@/types/stock';

const BASE_URL = 'https://api.jquants.com';

function apiKey(): string {
  const key = process.env.JQUANTS_API_KEY;
  if (!key) throw new Error('JQUANTS_API_KEY が設定されていません');
  return key;
}

interface JQuantsBar {
  Date: string;
  Code: string;
  O: number;
  H: number;
  L: number;
  C: number;
  Vo: number;
  AdjO: number;
  AdjH: number;
  AdjL: number;
  AdjC: number;
  AdjVo: number;
}

interface BarsResponse {
  data: JQuantsBar[];
  pagination_key?: string;
}

export async function fetchDailyQuotes(
  code: string,
  from: string,
  to?: string,
): Promise<StockData[]> {
  const key = apiKey();
  const toParam = to ? `&to=${to}` : '';
  const baseUrl = `${BASE_URL}/v2/equities/bars/daily?code=${code}&from=${from}${toParam}`;

  let bars: JQuantsBar[] = [];
  let url = baseUrl;

  while (true) {
    let res = await fetch(url, { headers: { 'x-api-key': key } });

    // 429 rate limit (free plan: 5 req/min): wait 12s and retry once
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 12000));
      res = await fetch(url, { headers: { 'x-api-key': key } });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`bars/daily failed: ${res.status} ${text}`);
    }

    const data = await res.json() as BarsResponse;
    bars = [...bars, ...(data.data ?? [])];

    if (!data.pagination_key) break;
    url = `${baseUrl}&pagination_key=${data.pagination_key}`;
  }

  return bars
    .sort((a, b) => a.Date.localeCompare(b.Date))
    .map(b => ({
      date: b.Date,
      open: Math.round(b.AdjO ?? b.O),
      high: Math.round(b.AdjH ?? b.H),
      low: Math.round(b.AdjL ?? b.L),
      close: Math.round(b.AdjC ?? b.C),
      volume: Math.round(b.AdjVo ?? b.Vo),
    }));
}

interface JQuantsInfo {
  Code: string;
  CompanyName: string;
}

interface InfoResponse {
  info: JQuantsInfo[];
}

export async function fetchListedInfo(code: string): Promise<{ code: string; name: string } | null> {
  const key = apiKey();
  const res = await fetch(`${BASE_URL}/v2/listed/info?code=${code}`, {
    headers: { 'x-api-key': key },
  });

  if (!res.ok) return null;

  const data = await res.json() as InfoResponse;
  const info = data.info?.[0];
  if (!info) return null;

  return { code: info.Code, name: info.CompanyName };
}
