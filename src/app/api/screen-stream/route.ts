import { NextRequest } from 'next/server';
import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  return _openai;
}

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

// Sector normalization - ONLY true synonyms
const SECTOR_ALIASES: Record<string, string> = {
  'climate tech': 'climate', 'climatetech': 'climate', 'cleantech': 'climate', 'clean tech': 'climate',
  'agtech': 'agritech', 'ag tech': 'agritech', 'ag-tech': 'agritech',
  'artificial intelligence': 'ai', 'a.i.': 'ai',
  'fin tech': 'fintech', 'fin-tech': 'fintech',
  'health tech': 'healthtech', 'health-tech': 'healthtech',
  'deep tech': 'deeptech', 'deep-tech': 'deeptech',
  'hard tech': 'hardware', 'hard-tech': 'hardware',
  'defence': 'defense',
};

const STAGE_ALIASES: Record<string, string> = {
  'pre-seed': 'Pre-seed', 'preseed': 'Pre-seed', 'pre seed': 'Pre-seed',
  'seed': 'Seed', 'seed stage': 'Seed',
  'series a': 'Series A', 'series-a': 'Series A', 'seriesa': 'Series A',
  'series b': 'Series B', 'series-b': 'Series B', 'seriesb': 'Series B',
  'series c': 'Series C', 'series-c': 'Series C', 'seriesc': 'Series C',
  'series d': 'Series D', 'series-d': 'Series D', 'seriesd': 'Series D',
  'growth': 'Growth', 'growth stage': 'Growth', 'late stage': 'Growth',
};

function normalizeSector(sector: string): string {
  const lower = sector.toLowerCase().trim();
  return SECTOR_ALIASES[lower] || lower;
}

function normalizeStage(stage: string): string {
  const lower = stage.toLowerCase().trim();
  return STAGE_ALIASES[lower] || lower;
}

const STAGE_CHECK_SIZE_BOUNDS: Record<string, { min: number; max: number }> = {
  'Pre-seed': { min: 10000, max: 2000000 },
  'Seed': { min: 50000, max: 10000000 },
  'Series A': { min: 500000, max: 50000000 },
  'Series B': { min: 2000000, max: 100000000 },
  'Series C': { min: 5000000, max: 250000000 },
  'Series D': { min: 10000000, max: 500000000 },
  'Growth': { min: 5000000, max: 500000000 },
};

const ABSOLUTE_CHECK_SIZE_BOUNDS = { min: 1000, max: 1000000000 };

interface SanityCheckResult {
  valid: boolean;
  warnings: string[];
  shouldClearCheckSize: boolean;
}

function validateEnrichmentSanity(enrichment: EnrichmentData): SanityCheckResult {
  const warnings: string[] = [];
  let shouldClearCheckSize = false;

  if (enrichment.checkSizeMin !== null || enrichment.checkSizeMax !== null) {
    const min = enrichment.checkSizeMin;
    const max = enrichment.checkSizeMax;

    if (min !== null && max !== null && min > max) {
      warnings.push(`Check size min (€${(min/1e6).toFixed(1)}M) > max (€${(max/1e6).toFixed(1)}M)`);
      shouldClearCheckSize = true;
    }
    if (min !== null && (min < ABSOLUTE_CHECK_SIZE_BOUNDS.min || min > ABSOLUTE_CHECK_SIZE_BOUNDS.max)) {
      warnings.push(`Check size min €${(min/1e6).toFixed(1)}M outside absolute bounds`);
      shouldClearCheckSize = true;
    }
    if (max !== null && (max < ABSOLUTE_CHECK_SIZE_BOUNDS.min || max > ABSOLUTE_CHECK_SIZE_BOUNDS.max)) {
      warnings.push(`Check size max €${(max/1e6).toFixed(1)}M outside absolute bounds`);
      shouldClearCheckSize = true;
    }

    if (enrichment.stages.length > 0 && (min !== null || max !== null)) {
      let lowestMin = Infinity;
      let highestMax = 0;
      let lowestMax = Infinity;

      for (const stage of enrichment.stages) {
        const bounds = STAGE_CHECK_SIZE_BOUNDS[stage];
        if (bounds) {
          lowestMin = Math.min(lowestMin, bounds.min);
          highestMax = Math.max(highestMax, bounds.max);
          lowestMax = Math.min(lowestMax, bounds.max);
        }
      }

      if (lowestMin !== Infinity && highestMax > 0) {
        if (min !== null && lowestMax !== Infinity && min > lowestMax * 2) {
          warnings.push(`Check size min €${(min/1e6).toFixed(0)}M too high for ${enrichment.stages[0]}`);
          shouldClearCheckSize = true;
        }
        if (min !== null && min > highestMax * 5) {
          warnings.push(`Check size min €${(min/1e6).toFixed(0)}M implausibly high`);
          shouldClearCheckSize = true;
        }
        if (max !== null && max < lowestMin / 10) {
          warnings.push(`Check size max €${(max/1e6).toFixed(1)}M too low for ${enrichment.stages.join(', ')}`);
          shouldClearCheckSize = true;
        }
      }
    }
  }

  return { valid: warnings.length === 0, warnings, shouldClearCheckSize };
}

interface EnrichmentData {
  sectors: string[];
  checkSizeMin: number | null;
  checkSizeMax: number | null;
  stages: string[];
  geoFocus: string[];
  investmentThesis: string;
  noLongerInvesting: boolean;
  softwareOnly: boolean;
  relevantPortfolio: string[];
  isActualInvestor: boolean;
  organizationType: string;
  geographicRestrictions: string | null;
  geographicExceptions: boolean;
  description: string;
}

// Subpages to check on investor websites
const SUBPAGES_TO_CHECK = [
  '/about', '/about-us', '/invest', '/investment', '/investments',
  '/thesis', '/investment-thesis', '/focus', '/approach', '/what-we-do',
  '/criteria', '/team', '/portfolio',
];

// Fetch a page using plain fetch + HTML stripping (no puppeteer needed)
async function fetchSinglePage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    // Strip HTML tags to get text content
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return text || null;
  } catch {
    return null;
  }
}

interface WebsiteContent {
  baseUrl: string;
  homepage: string;
  subpages: Map<string, string>;
}

async function fetchHomepageOnly(website: string): Promise<WebsiteContent | null> {
  if (!website) return null;

  try {
    const url = website.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const baseUrls = [`https://${url}`, `https://www.${url}`];

    for (const tryUrl of baseUrls) {
      const homepageContent = await fetchSinglePage(tryUrl);
      if (homepageContent) {
        return { baseUrl: tryUrl, homepage: homepageContent, subpages: new Map() };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchSubpages(content: WebsiteContent): Promise<void> {
  const batchSize = 5;

  for (let i = 0; i < SUBPAGES_TO_CHECK.length; i += batchSize) {
    const batch = SUBPAGES_TO_CHECK.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(path => fetchSinglePage(`${content.baseUrl}${path}`))
    );
    results.forEach((pageContent, idx) => {
      if (pageContent && pageContent.length > 200) {
        content.subpages.set(batch[idx], pageContent);
      }
    });
  }
}

function combineContent(content: WebsiteContent, includeSubpages: boolean): string {
  let combined = `--- HOMEPAGE ---\n${content.homepage.slice(0, 10000)}`;

  if (includeSubpages && content.subpages.size > 0) {
    for (const [path, pageContent] of content.subpages) {
      combined += `\n--- PAGE: ${path} ---\n${pageContent.slice(0, 8000)}`;
    }
  }

  return combined.slice(0, 30000);
}

interface ClientProfile {
  companyName: string;
  description: string;
  sector: string;
  technology: string;
  productType: string;
  businessModel: string;
  targetMarket: string;
  keywords: string[];
}

async function analyzeClientWebsite(clientName: string, clientWebsite: string | undefined): Promise<ClientProfile | null> {
  if (!clientWebsite) return null;

  try {
    const websiteContent = await fetchHomepageOnly(clientWebsite);
    if (!websiteContent) return null;

    await fetchSubpages(websiteContent);
    const fullContent = combineContent(websiteContent, true);

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert at analyzing startup/company websites. Build a comprehensive profile of what this company does.' },
        {
          role: 'user',
          content: `Analyze "${clientName}" website and create a detailed company profile:\n\n${fullContent}\n\nReturn JSON:\n{\n  "companyName": "${clientName}",\n  "description": "2-3 sentence description",\n  "sector": "Primary sector",\n  "technology": "Core technology or innovation",\n  "productType": "What they sell",\n  "businessModel": "B2B, B2C, etc.",\n  "targetMarket": "Who are their customers",\n  "keywords": ["list", "of", "relevant", "keywords"]\n}\n\nBe specific and detailed.`
        }
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Error analyzing client website:', error);
    return null;
  }
}

async function assessInvestorFit(
  investorName: string,
  investorData: EnrichmentData,
  clientProfile: ClientProfile | null,
  clientCriteria: ClientCriteria
): Promise<{ isMatch: boolean; confidence: 'high' | 'medium' | 'low'; reasoning: string }> {
  let clientDescription: string;

  if (clientProfile) {
    clientDescription = `Company: ${clientProfile.companyName}\nDescription: ${clientProfile.description}\nSector: ${clientProfile.sector}\nTechnology: ${clientProfile.technology}\nProduct: ${clientProfile.productType}\nBusiness Model: ${clientProfile.businessModel}\nTarget Market: ${clientProfile.targetMarket}\nKeywords: ${clientProfile.keywords.join(', ')}\nStage: ${clientCriteria.stages.join(', ')}\nRaising: €${(clientCriteria.checkSize / 1e6).toFixed(1)}M\nLocation: ${clientCriteria.geoFocus.join(', ')}\nHardware company: ${clientCriteria.isHardware ? 'Yes' : 'No'}`;
  } else {
    clientDescription = `Company: ${clientCriteria.clientName}\nSectors: ${[...clientCriteria.sectors, ...(clientCriteria.customSectors || [])].join(', ')}\nStage: ${clientCriteria.stages.join(', ')}\nRaising: €${(clientCriteria.checkSize / 1e6).toFixed(1)}M\nLocation: ${clientCriteria.geoFocus.join(', ')}\nHardware company: ${clientCriteria.isHardware ? 'Yes' : 'No'}`;
  }

  const investorDescription = `Investor: ${investorName}\nType: ${investorData.organizationType}\nSectors: ${investorData.sectors.join(', ') || 'Not specified'}\nStages: ${investorData.stages.join(', ') || 'Not specified'}\nCheck size: ${investorData.checkSizeMin ? `€${(investorData.checkSizeMin/1e6).toFixed(1)}M` : '?'} - ${investorData.checkSizeMax ? `€${(investorData.checkSizeMax/1e6).toFixed(1)}M` : '?'}\nGeo focus: ${investorData.geoFocus.join(', ') || 'Global'}\nGeographic restrictions: ${investorData.geographicRestrictions || 'None'}\nThesis: ${investorData.investmentThesis || 'Not specified'}\nSoftware only: ${investorData.softwareOnly ? 'Yes' : 'No'}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at matching startups with investors. Assess if an investor would be interested in a specific company.\n\nConsider:\n- Sector/industry alignment (be broad - "deeptech" includes robotics, 3D printing, advanced manufacturing, etc.)\n- Stage fit\n- Check size vs raise amount\n- Geographic fit\n- Technology/product alignment with investor thesis\n\nBe GENEROUS with sector matching.`
        },
        {
          role: 'user',
          content: `Would this investor be a good fit for this company?\n\n=== CLIENT/STARTUP ===\n${clientDescription}\n\n=== INVESTOR ===\n${investorDescription}\n\nReturn JSON:\n{\n  "isMatch": boolean,\n  "confidence": "high" | "medium" | "low",\n  "reasoning": "Brief explanation"\n}\n\nReturn ONLY valid JSON.`
        }
      ],
      temperature: 0,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { isMatch: false, confidence: 'low', reasoning: 'Could not assess fit' };
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { isMatch: false, confidence: 'low', reasoning: 'Error assessing fit' };
  }
}

async function extractWithLLM(investorName: string, websiteContent: string): Promise<EnrichmentData | null> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing venture capital and investment firm websites. Extract structured information about the investor.\n\nCRITICAL RULES:\n1. "check_size" is what THIS INVESTOR invests per deal. Ignore deal announcements, fund sizes, or portfolio news.\n2. Determine if this is an ACTUAL INVESTOR that writes checks, or a non-investing org.\n3. GEOGRAPHIC RESTRICTIONS: ONLY if website explicitly says WHERE PORTFOLIO COMPANIES must be located.\n   - "Israeli fund", "US-based VC" = describes THE INVESTOR's location, NOT where they invest. Return NULL.\n   - If unclear or not explicitly stated, return NULL.`
        },
        {
          role: 'user',
          content: `Analyze "${investorName}" website:\n\n${websiteContent}\n\nReturn JSON:\n{\n  "is_actual_investor": boolean,\n  "organization_type": "vc" | "cvc" | "pe" | "angel" | "family-office" | "accelerator" | "incubator" | "hub" | "co-working" | "grant" | "government" | "non-profit" | "unknown",\n  "geographic_restrictions": string or null,\n  "geographic_exceptions": boolean,\n  "sectors": ["climate", "agritech", "robotics", "saas", "fintech", "healthtech", "hardware", "ai", "logistics", "defense"],\n  "check_size_min_eur": number or null,\n  "check_size_max_eur": number or null,\n  "stages": ["pre-seed", "seed", "series-a", "series-b", "growth"],\n  "geo_focus": ["usa", "europe", "uk", "global"],\n  "investment_thesis": "1-2 sentence summary",\n  "no_longer_investing": boolean,\n  "software_only": boolean,\n  "relevant_portfolio": ["up to 5 names"],\n  "description": "A 3-sentence professional bio of this investor."\n}\n\nReturn ONLY valid JSON.`
        }
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const parseCheckSize = (val: number | null | undefined): number | null => {
      if (val === null || val === undefined || val < 1000) return null;
      return val;
    };

    return {
      sectors: parsed.sectors || [],
      checkSizeMin: parseCheckSize(parsed.check_size_min_eur),
      checkSizeMax: parseCheckSize(parsed.check_size_max_eur),
      stages: parsed.stages || [],
      geoFocus: parsed.geo_focus || [],
      investmentThesis: parsed.investment_thesis || '',
      noLongerInvesting: parsed.no_longer_investing || false,
      softwareOnly: parsed.software_only || false,
      relevantPortfolio: parsed.relevant_portfolio || [],
      isActualInvestor: parsed.is_actual_investor !== false,
      organizationType: parsed.organization_type || 'unknown',
      geographicRestrictions: parsed.geographic_restrictions || null,
      geographicExceptions: parsed.geographic_exceptions || false,
      description: parsed.description || '',
    };
  } catch {
    return null;
  }
}

function hasClearVerdict(enrichment: EnrichmentData | null, criteria: { isHardware: boolean }): { clear: boolean; reason: string } {
  if (!enrichment) return { clear: false, reason: 'no data' };
  if (enrichment.noLongerInvesting) return { clear: true, reason: 'disqualify: no longer investing' };
  if (!enrichment.isActualInvestor) return { clear: true, reason: `disqualify: not an investor (${enrichment.organizationType})` };
  if (enrichment.geographicRestrictions) return { clear: true, reason: `disqualify: geographic restriction` };
  if (criteria.isHardware && enrichment.softwareOnly) return { clear: true, reason: 'disqualify: software-only' };

  const hasCheckSize = enrichment.checkSizeMin !== null || enrichment.checkSizeMax !== null;
  const hasStages = enrichment.stages.length > 0;
  const hasSectors = enrichment.sectors.length > 0;

  if (hasCheckSize && hasStages && hasSectors) return { clear: true, reason: 'qualify: sufficient data' };
  return { clear: false, reason: `incomplete` };
}

async function scoreInvestor(
  enrichment: EnrichmentData | null,
  criteria: ClientCriteria,
  hq: string | null,
  enrichmentFlags: string | null = null,
  clientProfile: ClientProfile | null = null,
  investorName: string = ''
): Promise<{ verdict: string; score: number; reasoning: string; industryFocus: string; checkSizeMin: number | null; checkSizeMax: number | null }> {
  let score = 5;
  const reasons: string[] = [];
  let industryFocus = 'general';

  if (!enrichment) {
    return { verdict: 'Needs review: website unavailable', score: 5, reasoning: 'Could not analyze investor website.', industryFocus: 'unknown', checkSizeMin: null, checkSizeMax: null };
  }

  let hasDataQualityIssues = false;
  if (enrichmentFlags) {
    reasons.push(`⚠️ Data quality issues: ${enrichmentFlags}`);
    hasDataQualityIssues = true;
  }

  if (enrichment.noLongerInvesting) {
    return { verdict: 'Disqualified', score: 1, reasoning: 'No longer making investments.', industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
  }

  if (!enrichment.isActualInvestor) {
    return { verdict: 'Disqualified', score: 1, reasoning: `Not an investor — this is a ${enrichment.organizationType}.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
  }

  let isSecondaryGeo = false;

  if (enrichment.geographicRestrictions) {
    const restriction = enrichment.geographicRestrictions.toLowerCase();
    const clientGeos = criteria.geoFocus.map(g => g.toLowerCase());
    const hasExceptions = enrichment.geographicExceptions;

    const clientInUK = clientGeos.includes('uk');
    const clientInEuropeNotUK = clientGeos.includes('europe') || clientGeos.some(g => ['germany', 'france', 'netherlands', 'spain', 'italy', 'sweden', 'denmark', 'finland', 'norway', 'austria', 'switzerland', 'belgium', 'ireland', 'portugal', 'poland', 'czechia', 'luxembourg'].includes(g));
    const clientInUSA = clientGeos.includes('usa');

    const investorUKOnly = (restriction.includes('uk') || restriction.includes('united kingdom')) && !restriction.includes('europe') && !restriction.includes('global');
    const investorCoversEurope = restriction.includes('europe') || restriction.includes('eu ') || restriction.includes('european');
    const investorCoversUK = restriction.includes('uk') || restriction.includes('united kingdom');
    const investorCoversSubRegion = restriction.includes('dach') || restriction.includes('nordic') || restriction.includes('germany') || restriction.includes('france') || restriction.includes('netherlands');
    const hasGlobalFocus = restriction.includes('global') || restriction.includes('worldwide') || restriction.includes('international');
    const investorNonEuropean = !hasGlobalFocus && (restriction.includes('israel') || restriction.includes('mena') || restriction.includes('america') || restriction.includes('asia') || restriction.includes('india') || restriction.includes('china') || restriction.includes('latin')) && !restriction.includes('europe') && !restriction.includes('uk');
    const isHardRestriction = restriction.includes('only') || restriction.includes('must be based') || restriction.includes('exclusively');

    if (clientInUK) {
      const isSubRegionOnly = investorCoversSubRegion && !investorCoversEurope && !investorCoversUK && !hasGlobalFocus;
      if (isSubRegionOnly) {
        return { verdict: 'Disqualified', score: 2, reasoning: `Geographic restriction: ${enrichment.geographicRestrictions}.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
      } else if (investorNonEuropean) {
        return { verdict: 'Disqualified', score: 2, reasoning: `Geographic restriction: ${enrichment.geographicRestrictions}.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
      } else if (investorCoversSubRegion && hasExceptions && !investorCoversUK) {
        isSecondaryGeo = true;
        reasons.push(`Geography: ${enrichment.geographicRestrictions}, UK may need local lead`);
      } else {
        reasons.push(`Geography: ${enrichment.geographicRestrictions}`);
      }
    } else if (clientInEuropeNotUK) {
      if (investorUKOnly) {
        return { verdict: 'Disqualified', score: 2, reasoning: `Geographic restriction: investor is UK-only.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
      } else if (investorNonEuropean) {
        return { verdict: 'Disqualified', score: 2, reasoning: `Geographic restriction: ${enrichment.geographicRestrictions}.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
      } else {
        reasons.push(`Geography: ${enrichment.geographicRestrictions}`);
      }
    } else if (clientInUSA) {
      if (restriction.includes('usa') || restriction.includes('us ') || restriction.includes('america') || hasGlobalFocus) {
        reasons.push(`Geography: ${enrichment.geographicRestrictions}`);
      } else if (isHardRestriction) {
        return { verdict: 'Disqualified', score: 2, reasoning: `Geographic restriction: ${enrichment.geographicRestrictions}.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
      } else {
        isSecondaryGeo = true;
        reasons.push(`Geography: ${enrichment.geographicRestrictions}, USA may be outside core focus`);
      }
    } else {
      if (isHardRestriction && !clientGeos.some(g => restriction.includes(g))) {
        return { verdict: 'Disqualified', score: 2, reasoning: `Geographic restriction: ${enrichment.geographicRestrictions}.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
      } else {
        reasons.push(`Geography: ${enrichment.geographicRestrictions}`);
      }
    }
  }

  if (criteria.isHardware && enrichment.softwareOnly) {
    return { verdict: 'Disqualified', score: 2, reasoning: 'Software-only investor.', industryFocus: 'software', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
  }

  if (enrichment.checkSizeMin !== null && enrichment.checkSizeMin > criteria.checkSize * 1.5) {
    return { verdict: 'Disqualified', score: 2, reasoning: `Check size mismatch: minimum ticket €${(enrichment.checkSizeMin/1e6).toFixed(1)}M > target raise €${(criteria.checkSize/1e6).toFixed(1)}M.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
  }

  const stageMatches = criteria.stages.filter(s => enrichment.stages.includes(s));
  const hasCheckSizeInfo = enrichment.checkSizeMin !== null || enrichment.checkSizeMax !== null;

  if (!hasCheckSizeInfo && enrichment.stages.length > 0 && criteria.stages.length > 0 && stageMatches.length === 0) {
    return { verdict: 'Disqualified', score: 2, reasoning: `Stage mismatch: ${enrichment.stages.join(', ')} vs ${criteria.stages.join(', ')}.`, industryFocus: 'n/a', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
  }

  if (enrichment.checkSizeMin !== null && enrichment.checkSizeMax !== null) {
    if (criteria.checkSize >= enrichment.checkSizeMin && criteria.checkSize <= enrichment.checkSizeMax) {
      score += 2;
      reasons.push(`Check size fits range (€${(enrichment.checkSizeMin/1e6).toFixed(0)}-${(enrichment.checkSizeMax/1e6).toFixed(0)}M)`);
    }
  }

  const fitAssessment = await assessInvestorFit(investorName, enrichment, clientProfile, criteria);

  if (fitAssessment.isMatch) {
    if (fitAssessment.confidence === 'high') score += 3;
    else if (fitAssessment.confidence === 'medium') score += 2;
    else score += 1;
    reasons.push(fitAssessment.reasoning);
    industryFocus = enrichment.sectors[0] || clientProfile?.sector || 'matched';
  } else {
    if (fitAssessment.confidence === 'high') {
      return { verdict: 'Disqualified', score: 2, reasoning: `Not a fit: ${fitAssessment.reasoning}`, industryFocus: enrichment.sectors[0] || 'other', checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
    } else {
      reasons.push(`Potential mismatch: ${fitAssessment.reasoning}`);
    }
  }

  if (stageMatches.length > 0) {
    score += 1;
    reasons.push(`Stage: ${stageMatches.join(', ')}`);
  }

  if (enrichment.investmentThesis) {
    reasons.push(`Thesis: "${enrichment.investmentThesis}"`);
  }

  score = Math.max(1, Math.min(10, Math.round(score)));

  let verdict: string;
  const hasCheckSize = enrichment.checkSizeMin !== null || enrichment.checkSizeMax !== null;
  const hasStages = enrichment.stages.length > 0;
  const hasSectors = enrichment.sectors.length > 0;

  const canLead = enrichment.checkSizeMax !== null && enrichment.checkSizeMax >= criteria.checkSize && !isSecondaryGeo;
  const canCoLead = (hasCheckSize && enrichment.checkSizeMax !== null && enrichment.checkSizeMax < criteria.checkSize) || isSecondaryGeo;

  if (hasDataQualityIssues && score < 9) {
    verdict = score <= 3 ? 'Disqualified' : 'Needs review: conflicting information on site';
  } else if (score >= 7) {
    if (canCoLead || isSecondaryGeo) verdict = 'Qualified: Co-lead';
    else if (canLead) verdict = 'Qualified: Lead';
    else if (!hasCheckSize) verdict = isSecondaryGeo ? 'Qualified: Co-lead' : 'Qualified';
    else verdict = 'Qualified: Lead';
  } else if (score <= 3) {
    verdict = 'Disqualified';
  } else {
    if (!hasCheckSize && !hasStages) verdict = 'Needs review: no ticket size or stage found';
    else if (!hasSectors) verdict = 'Needs review: sector focus unclear';
    else if (!hasCheckSize && !hasStages) verdict = 'Needs review: limited information';
    else verdict = 'Needs review: inconclusive match';
  }

  return { verdict, score, reasoning: reasons.join('. ') || 'Limited info.', industryFocus, checkSizeMin: enrichment.checkSizeMin, checkSizeMax: enrichment.checkSizeMax };
}

interface ExtendedClientProfile {
  companyName: string | null;
  oneLiner: string | null;
  sector: string | null;
  subSectors: string[] | null;
  technology: { core: string | null; description: string | null; differentiators: string[] | null; } | null;
  product: { type: string | null; offerings: string[] | null; description: string | null; } | null;
  businessModel: { type: string | null; revenueModel: string | null; description: string | null; } | null;
  targetMarket: { industries: string[] | null; customerProfile: string | null; geographicFocus: string | null; } | null;
  stage: { estimated: string | null; signals: string[] | null; } | null;
  team: { founders: string[] | null; size: string | null; location: string | null; } | null;
  traction: { customers: string[] | null; milestones: string[] | null; } | null;
  investorFitKeywords: string[] | null;
}

function convertToSimpleProfile(extended: ExtendedClientProfile, clientName: string): ClientProfile {
  return {
    companyName: extended.companyName || clientName,
    description: extended.oneLiner || '',
    sector: extended.sector || '',
    technology: extended.technology?.description || extended.technology?.core || '',
    productType: extended.product?.type || '',
    businessModel: extended.businessModel?.type || '',
    targetMarket: extended.targetMarket?.industries?.join(', ') || extended.targetMarket?.customerProfile || '',
    keywords: [
      ...(extended.subSectors || []),
      ...(extended.investorFitKeywords || []),
      ...(extended.targetMarket?.industries || []),
    ].filter(Boolean),
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { investors, criteria, clientProfile: extendedClientProfile }: {
    investors: InvestorInput[];
    criteria: ClientCriteria;
    clientProfile?: ExtendedClientProfile | null;
  } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const results: object[] = [];
      const total = investors.length;

      send({ type: 'start', total });

      // Use client profile from frontend if available, otherwise analyze
      let clientProfile: ClientProfile | null = null;

      if (extendedClientProfile) {
        clientProfile = convertToSimpleProfile(extendedClientProfile, criteria.clientName);
      } else if (criteria.clientWebsite) {
        send({ type: 'progress', current: 0, total, investor: `Analyzing ${criteria.clientName} website...` });
        clientProfile = await analyzeClientWebsite(criteria.clientName, criteria.clientWebsite);
      }

      for (let i = 0; i < investors.length; i++) {
        const inv = investors[i];

        send({ type: 'progress', current: i + 1, total, investor: inv.name });

        let enrichment: EnrichmentData | null = null;
        let enrichmentFlags: string | null = null;

        if (inv.website) {
          // Step 1: Fetch homepage
          const websiteContent = await fetchHomepageOnly(inv.website);

          if (websiteContent) {
            // Step 2: Analyze homepage first
            const homepageText = combineContent(websiteContent, false);
            enrichment = await extractWithLLM(inv.name, homepageText);

            if (enrichment) {
              enrichment.sectors = enrichment.sectors.map(normalizeSector);
              enrichment.stages = enrichment.stages.map(normalizeStage);

              // Step 3: Check if we have a clear verdict from homepage
              const verdictCheck = hasClearVerdict(enrichment, criteria);

              if (!verdictCheck.clear) {
                // Step 4: Not enough data - fetch subpages and re-analyze
                await fetchSubpages(websiteContent);

                if (websiteContent.subpages.size > 0) {
                  const fullText = combineContent(websiteContent, true);
                  const enrichedAgain = await extractWithLLM(inv.name, fullText);

                  if (enrichedAgain) {
                    enrichment = enrichedAgain;
                    enrichment.sectors = enrichment.sectors.map(normalizeSector);
                    enrichment.stages = enrichment.stages.map(normalizeStage);
                  }
                }
              }

              // Sanity checks
              const sanityResult = validateEnrichmentSanity(enrichment);
              if (sanityResult.shouldClearCheckSize) {
                enrichment.checkSizeMin = null;
                enrichment.checkSizeMax = null;
              }
              enrichmentFlags = sanityResult.warnings.length > 0 ? sanityResult.warnings.join('; ') : null;
            }
          }
        }

        const { verdict, score, reasoning, industryFocus, checkSizeMin, checkSizeMax } = await scoreInvestor(enrichment, criteria, inv.hq || null, enrichmentFlags, clientProfile, inv.name);

        results.push({
          investor_name: inv.name,
          website: inv.website || null,
          hq: inv.hq || null,
          verdict,
          relevance_score: score,
          reasoning,
          industry_focus: industryFocus,
          check_size_min: checkSizeMin,
          check_size_max: checkSizeMax,
        });
      }

      const qualified = results.filter((r: any) => r.verdict?.toLowerCase().startsWith('qualified')).length;
      const disqualified = results.filter((r: any) => r.verdict?.toLowerCase() === 'disqualified').length;
      const needsReview = results.filter((r: any) => r.verdict?.toLowerCase().startsWith('needs review')).length;

      send({
        type: 'complete',
        results: results.sort((a: any, b: any) => (b.relevance_score || 0) - (a.relevance_score || 0)),
        summary: { qualified, disqualified, needsReview, total }
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
