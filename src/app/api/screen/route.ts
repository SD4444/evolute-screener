import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple single-investor screening endpoint
export async function POST(request: NextRequest) {
  try {
    const { investor, criteria } = await request.json();
    
    const allSectors = [...(criteria.sectors || []), ...(criteria.customSectors || [])];
    
    const prompt = `You are an expert at qualifying investors for startup fundraising.

## Client Seeking Investment
- Company: ${criteria.clientName}
- Website: ${criteria.clientWebsite || 'Not provided'}
- Sectors: ${allSectors.join(', ')}
- Seeking: €${((criteria.checkSize || 1000000) / 1000000).toFixed(1)}M
- Stage: ${(criteria.stages || []).join(', ')}
- Geographic Focus: ${(criteria.geoFocus || []).join(', ')}
- Hardware/DeepTech: ${criteria.isHardware ? 'Yes' : 'No (Software)'}

## Investor to Evaluate
- Name: ${investor.name}
- Website: ${investor.website || 'Not provided'}
- HQ: ${investor.hq || 'Not provided'}

## Task
Determine if this investor is likely a good match for the client.

Respond with JSON:
{
  "verdict": "qualified" | "disqualified" | "needs-review",
  "relevanceScore": 1-10,
  "reasoning": "2-3 sentences explaining your decision"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');
    
    const result = JSON.parse(content);
    
    return NextResponse.json({
      verdict: result.verdict || 'needs-review',
      relevanceScore: result.relevanceScore || 5,
      reasoning: result.reasoning || 'Unable to determine qualification',
    });
  } catch (error) {
    console.error('Screening error:', error);
    return NextResponse.json({ 
      error: 'Screening failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
