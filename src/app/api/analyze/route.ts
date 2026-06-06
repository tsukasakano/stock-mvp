import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      stockCode: string;
      stockName: string;
      latestClose: number;
      latestRSI?: number;
      latestMACD?: number;
      latestSignal?: number;
      upperBand?: number;
      lowerBand?: number;
      middleBand?: number;
      priceChange: string;
    };

    const {
      stockCode, stockName, latestClose, latestRSI,
      latestMACD, latestSignal, upperBand, lowerBand, priceChange,
    } = body;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `以下の株式テクニカル指標を分析し、短期的な見通しを日本語で説明してください。

銘柄: ${stockName}（${stockCode}）
現在値: ¥${latestClose?.toLocaleString()}
直近20日騰落率: ${priceChange}%
RSI(14): ${latestRSI?.toFixed(1) ?? 'N/A'}
MACD: ${latestMACD?.toFixed(2) ?? 'N/A'}
MACDシグナル: ${latestSignal?.toFixed(2) ?? 'N/A'}
ボリンジャーバンド上限: ¥${upperBand?.toFixed(0) ?? 'N/A'}
ボリンジャーバンド下限: ¥${lowerBand?.toFixed(0) ?? 'N/A'}

以下の観点から簡潔に分析してください：
1. トレンド（上昇・下降・横ばい）
2. RSIによる過熱感・売られすぎの判断
3. MACDのモメンタム
4. ボリンジャーバンドの位置
5. 総合的な短期見通し

※この分析は投資助言ではありません。投資判断は自己責任でお願いします。`,
      }],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ content });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : '分析に失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
