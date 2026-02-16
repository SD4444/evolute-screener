// Vercel-compatible: No persistent database
// All data is managed client-side via localStorage

export interface Investor {
  id: number;
  name: string;
  website: string | null;
  hq: string | null;
  sectors: string | null;
  check_size_min: number | null;
  check_size_max: number | null;
  stages: string | null;
  geo_focus: string | null;
  portfolio_signals: string | null;
  enrichment_flags: string | null;
  is_actual_investor: number | null;
  organization_type: string | null;
  geographic_restrictions: string | null;
  geographic_exceptions: number;
  description: string | null;
  last_enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreeningResult {
  id: number;
  investor_id: number;
  client_name: string;
  client_criteria: string | null;
  verdict: string;
  relevance_score: number;
  reasoning: string | null;
  industry_focus: string | null;
  screened_at: string;
  screened_by: string | null;
}

export interface ClientProfile {
  id: number;
  client_name: string;
  client_website: string | null;
  sectors: string | null;
  custom_sectors: string | null;
  check_size: number | null;
  stages: string | null;
  geo_focus: string | null;
  is_hardware: number;
  investor_input: string | null;
  created_at: string;
  updated_at: string;
}

// No-op functions for Vercel (data managed client-side)
export function getInvestors(): Investor[] { return []; }
export function getInvestorById(id: number): Investor | undefined { return undefined; }
export function getInvestorByNameAndWebsite(name: string, website: string | null): Investor | undefined { return undefined; }
export function createInvestor(data: Partial<Investor>): Investor { 
  return { ...data, id: Date.now() } as Investor; 
}
export function updateInvestor(id: number, data: Partial<Investor>): Investor | undefined { 
  return { ...data, id } as Investor; 
}
export function upsertInvestor(data: Partial<Investor>): Investor { 
  return { ...data, id: Date.now() } as Investor; 
}

export interface ScreeningResultWithInvestor extends ScreeningResult {
  investor_name: string;
  investor_website: string | null;
  investor_hq: string | null;
}

export function getScreeningResults(clientName?: string): (ScreeningResultWithInvestor & { screen_count: number })[] { return []; }
export function createScreeningResult(data: Partial<ScreeningResult>): ScreeningResult { 
  return { ...data, id: Date.now() } as ScreeningResult; 
}
export function getUniqueClientNames(): string[] { return []; }

export function getClientProfiles(): ClientProfile[] { return []; }
export function getClientProfileByName(name: string): ClientProfile | undefined { return undefined; }
export function upsertClientProfile(data: any): ClientProfile { return data as ClientProfile; }
export function deleteClientProfile(name: string): void {}
export function deleteScreeningResultsByClient(clientName: string): number { return 0; }

export default {};
