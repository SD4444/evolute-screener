import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  return _openai;
}

interface PageContent {
  url: string;
  title: string;
  content: string;
}

async function fetchPage(url: string): Promise<PageContent | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EvoluteBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    
    const html = await res.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;
    
    // Strip HTML to get text content
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit content size
    text = text.slice(0, 15000);
    
    return { url, title, content: text };
  } catch {
    return null;
  }
}

async function discoverPages(baseUrl: string, html: string): Promise<string[]> {
  const urls = new Set<string>();
  
  // Parse base URL
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  
  // Find all links
  const linkRegex = /href=["']([^"']+)["']/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      let fullUrl: URL;
      
      if (href.startsWith('http')) {
        fullUrl = new URL(href);
      } else if (href.startsWith('/')) {
        fullUrl = new URL(href, base.origin);
      } else {
        continue;
      }
      
      // Only same domain
      if (fullUrl.hostname !== base.hostname) continue;
      
      // Skip assets, anchors, etc
      const path = fullUrl.pathname.toLowerCase();
      if (path.match(/\.(jpg|jpeg|png|gif|svg|css|js|pdf|zip|mp4|webp|ico)$/)) continue;
      if (fullUrl.hash && !fullUrl.pathname) continue;
      
      // Prioritize useful pages
      const isUseful = path.includes('about') || 
                       path.includes('team') || 
                       path.includes('product') ||
                       path.includes('solution') ||
                       path.includes('service') ||
                       path.includes('technolog') ||
                       path.includes('portfolio') ||
                       path.includes('case') ||
                       path.includes('customer') ||
                       path.includes('partner') ||
                       path.includes('industr') ||
                       path.includes('application') ||
                       path.includes('material') ||
                       path.includes('feature') ||
                       path.includes('platform') ||
                       path.includes('pricing') ||
                       path.includes('company') ||
                       path === '/';
      
      if (isUseful) {
        urls.add(fullUrl.origin + fullUrl.pathname);
      }
    } catch {
      continue;
    }
  }
  
  return Array.from(urls).slice(0, 10); // Max 10 pages
}

export async function POST(req: NextRequest) {
  try {
    const { clientWebsite, keywords } = await req.json();
    
    if (!clientWebsite) {
      return NextResponse.json({ error: 'Client website required' }, { status: 400 });
    }
    
    // Normalize URL
    let baseUrl = clientWebsite.trim();
    if (!baseUrl.startsWith('http')) {
      baseUrl = 'https://' + baseUrl;
    }
    
    // Fetch homepage first
    const homeRes = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EvoluteBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    if (!homeRes.ok) {
      return NextResponse.json({ error: 'Could not fetch website' }, { status: 400 });
    }
    
    const homeHtml = await homeRes.text();
    
    // Discover additional pages
    const pageUrls = await discoverPages(baseUrl, homeHtml);
    
    // Fetch all pages in parallel
    const pagePromises = pageUrls.map(url => fetchPage(url));
    const pages = (await Promise.all(pagePromises)).filter(Boolean) as PageContent[];
    
    // Combine all content
    const combinedContent = pages.map(p => 
      `=== PAGE: ${p.title} (${p.url}) ===\n${p.content}`
    ).join('\n\n');
    
    // Build the analysis prompt
    const keywordContext = keywords && keywords.length > 0 
      ? `\nThe user has selected these keywords as relevant: ${keywords.join(', ')}. Use these as guidance for understanding what aspects of the business are most important for this analysis.`
      : '';
    
    const prompt = `Analyze this company's website content and extract a comprehensive profile. This will be used to match the company with potential investors.
${keywordContext}

Website content from ${pages.length} pages:

${combinedContent}

Extract and return a JSON object with this exact structure:
{
  "companyName": "Official company name",
  "oneLiner": "One sentence description of what they do",
  "sector": "Primary sector (e.g., DeepTech, CleanTech, HealthTech, etc.)",
  "subSectors": ["Array of specific sub-sectors/verticals"],
  "technology": {
    "core": "Main technology or technical approach",
    "description": "2-3 sentence explanation of the technology",
    "differentiators": ["What makes their tech unique"]
  },
  "product": {
    "type": "Hardware / Software / Platform / Service / Hybrid",
    "offerings": ["List of main products/services"],
    "description": "What they sell and to whom"
  },
  "businessModel": {
    "type": "B2B / B2C / B2B2C",
    "revenueModel": "How they make money (SaaS, hardware sales, licensing, etc.)",
    "description": "Brief explanation"
  },
  "targetMarket": {
    "industries": ["Target industries"],
    "customerProfile": "Who buys their product",
    "geographicFocus": "Where they operate/sell"
  },
  "stage": {
    "estimated": "Pre-seed / Seed / Series A / Series B / Growth / Mature",
    "signals": ["Evidence for this estimate (team size, production status, customers, etc.)"]
  },
  "team": {
    "founders": ["Founder names and roles if found"],
    "size": "Team size if mentioned",
    "location": "HQ location"
  },
  "traction": {
    "customers": ["Named customers or partners if mentioned"],
    "milestones": ["Key achievements, awards, metrics"]
  },
  "investorFitKeywords": ["Keywords that describe ideal investor focus areas"]
}

Be thorough but only include information you can confidently extract from the content. If information is not available, use null for that field.`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    
    // Extract JSON from response
    const responseText = response.choices[0]?.message?.content || '';
    
    // Try to parse JSON from response
    let profile;
    try {
      // Find JSON in response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        profile = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      return NextResponse.json({ error: 'Failed to parse profile' }, { status: 500 });
    }
    
    return NextResponse.json({
      profile,
      pagesAnalyzed: pages.length,
      pageUrls: pages.map(p => p.url),
    });
    
  } catch (error) {
    console.error('Analyze client error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
