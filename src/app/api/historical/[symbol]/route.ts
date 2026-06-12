import { readFileSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await params;
    const filePath = path.join(
      process.cwd(), 'public', 'data', 'historical', `${symbol}.json`,
    );
    const raw = readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Data not found' }, { status: 404 });
  }
}
