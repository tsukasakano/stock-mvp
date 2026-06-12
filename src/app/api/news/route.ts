import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { NewsSentimentResult } from '@/types/stock';

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { stockCode, stockName } = await request.json() as {
      stockCode: string;
      stockName: string;
    };

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `${stockName}（証券コード: ${stockCode}）に関する架空のニュース記事を5件生成してください。

以下のJSON形式のみを返してください。マークダウン・コードブロック・説明文は一切含めないこと。

{
  "news": [
    {
      "id": "1",
      "title": "日本語タイトル30〜50文字",
      "summary": "50〜80文字の要約",
      "sentiment": "positive" または "neutral" または "negative",
      "score": 0〜100の整数（positive=60〜100, neutral=40〜60, negative=0〜40）,
      "source": "日経新聞" または "ロイター" または "Bloomberg" または "共同通信" または "東洋経済",
      "publishedAt": "30分前" または "1時間前" または "2時間前" または "3時間前" または "本日朝",
      "impact": "high" または "medium" または "low"
    }
  ],
  "overallSentiment": "positive" または "neutral" または "negative",
  "overallScore": 0〜100の整数
}

ニュース内容は以下のトピックをバランスよく含めること：決算・業績、新製品・新サービス、提携・M&A、市場動向、アナリスト評価。
感情スコアにはばらつきを持たせ、すべてが同じ感情にならないようにすること。`,
      }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';

    // JSONブロックを抽出（```json ... ``` or { ... }）
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude returned unexpected format');

    const parsed = JSON.parse(jsonMatch[0]) as NewsSentimentResult;

    // 最低限のバリデーション
    if (!Array.isArray(parsed.news) || parsed.news.length === 0) {
      throw new Error('Invalid news structure');
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[news]', error);
    const msg = error instanceof Error ? error.message : 'ニュース生成に失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
