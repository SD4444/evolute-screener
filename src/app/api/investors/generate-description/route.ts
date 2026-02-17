import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  return _openai;
}

interface Investor {
  name: string;
  website: string | null;
  hq: string | null;
  sectors: string | null;
  check_size_min: number | null;
  check_size_max: number | null;
  stages: string | null;
  geo_focus: string | null;
  geographic_restrictions: string | null;
  organization_type: string | null;
  portfolio_signals: string | null;
}

function formatCheckSize(value: number | null): string {
  if (value === null) return 'unknown';
  if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `€${Math.round(value / 1000)}K`;
  return `€${value}`;
}

export async function POST(request: NextRequest) {
  try {
    const { investor } = await request.json() as { investor: Investor };
    if (!investor) return NextResponse.json({ error: 'Investor data required' }, { status: 400 });

    const context = `
Investor: ${investor.name}
Type: ${investor.organization_type || 'VC'}
HQ: ${investor.hq || 'Unknown'}
Website: ${investor.website || 'Unknown'}
Sectors: ${investor.sectors || 'Various'}
Check Size: ${formatCheckSize(investor.check_size_min)} - ${formatCheckSize(investor.check_size_max)}
Stages: ${investor.stages || 'Various'}
Geographic Focus: ${investor.geo_focus || 'Global'}
${investor.geographic_restrictions ? `Geographic Restrictions: ${investor.geographic_restrictions}` : ''}
${investor.portfolio_signals ? `Notable Portfolio: ${investor.portfolio_signals}` : ''}`.trim();

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a professional investment analyst. Write concise, factual descriptions of venture capital firms and investors.' },
        { role: 'user', content: `Write a 3-5 sentence description of this investor. Be factual and professional. Third person.\n\n${context}` }
      ],
    });

    const description = response.choices[0]?.message?.content?.trim() || '';
    return NextResponse.json({ description });
  } catch (error) {
    console.error('Error generating description:', error);
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}
