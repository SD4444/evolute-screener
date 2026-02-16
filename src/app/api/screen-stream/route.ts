import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ClientCriteria {
  clientName: string;
  clientWebsite?: string;
  sectors: string[];
  customSectors?: string[];
  checkSize: number;
  stages: string[];
  geoFocus: string[];
  isHardware: boolean;
  screenedBy?: string;
  userEmail?: string;
}

interface InvestorInput {
  name: string;
  website?: string;
  hq?: string;
}

export async function POST(request: NextRequest) {
  const { criteria, investors }: { criteria: ClientCriteria; investors: InvestorInput[] } = await request.json();
  
  // Create a readable stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      
      sendEvent('start', { 
        total: investors.length,
        message: `Starting to screen ${investors.length} investors...`
      });
      
      for (let i = 0; i < investors.length; i++) {
        const investor = investors[i];
        
        sendEvent('progress', { 
          current: i + 1, 
          total: investors.length,
          investor: investor.name,
          status: 'screening'
        });
        
        try {
          // Screen the investor using AI
          const result = await screenInvestor(investor, criteria);
          
          sendEvent('result', {
            index: i,
            investor: {
              name: investor.name,
              website: investor.website || null,
              hq: investor.hq || null,
            },
            screening: result
          });
        } catch (error) {
          console.error(`Error screening ${investor.name}:`, error);
          sendEvent('result', {
            index: i,
            investor: {
              name: investor.name,
              website: investor.website || null,
              hq: investor.hq || null,
            },
            screening: {
              verdict: 'error',
              relevanceScore: 0,
              reasoning: `Error screening investor: ${error instanceof Error ? error.message : 'Unknown error'}`,
              enrichedData: null
            }
          });
        }
      }
      
      sendEvent('complete', { 
        message: 'Screening complete!',
        total: investors.length
      });
      
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function screenInvestor(investor: InvestorInput, criteria: ClientCriteria) {
  const allSectors = [...criteria.sectors, ...(criteria.customSectors || [])];
  
  const prompt = `You are an expert at qualifying investors for startup fundraising.

## Client Seeking Investment
- Company: ${criteria.clientName}
- Website: ${criteria.clientWebsite || 'Not provided'}
- Sectors: ${allSectors.join(', ')}
- Seeking: €${(criteria.checkSize / 1000000).toFixed(1)}M
- Stage: ${criteria.stages.join(', ')}
- Geographic Focus: ${criteria.geoFocus.join(', ')}
- Hardware/DeepTech: ${criteria.isHardware ? 'Yes' : 'No (Software)'}

## Investor to Evaluate
- Name: ${investor.name}
- Website: ${investor.website || 'Not provided'}
- HQ: ${investor.hq || 'Not provided'}

## Task
Based on the investor's name, website, and HQ, determine if this investor is likely a good match for the client.

Consider:
1. Does the investor name suggest they invest in the relevant sectors?
2. Does their geographic location align with the client's target regions?
3. Are there any obvious mismatches (e.g., "Healthcare Fund" for a fintech company)?

Respond with a JSON object:
{
  "verdict": "qualified" | "disqualified" | "needs-review",
  "relevanceScore": 1-10,
  "reasoning": "2-3 sentences explaining your decision",
  "sectors": ["detected sectors based on name"],
  "geographicMatch": true | false,
  "confidence": "high" | "medium" | "low"
}

If you cannot determine a clear match/mismatch from the limited info, use "needs-review".
Be conservative - when in doubt, mark as "needs-review" rather than disqualify.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');
    
    const result = JSON.parse(content);
    
    return {
      verdict: result.verdict || 'needs-review',
      relevanceScore: result.relevanceScore || 5,
      reasoning: result.reasoning || 'Unable to determine qualification',
      enrichedData: {
        sectors: result.sectors || [],
        geographicMatch: result.geographicMatch,
        confidence: result.confidence || 'low'
      }
    };
  } catch (error) {
    console.error('AI screening error:', error);
    return {
      verdict: 'needs-review',
      relevanceScore: 5,
      reasoning: 'Could not complete AI analysis - manual review recommended',
      enrichedData: null
    };
  }
}
