'use client';

import { useState, useEffect } from 'react';

interface ScreeningResult {
  id: number;
  investorName: string;
  website: string | null;
  hq: string | null;
  verdict: string;
  relevanceScore: number;
  reasoning: string;
  industryFocus: string;
  clientName: string;
  screenedAt: string;
  isRescreen?: boolean;
  screenCount?: number;
  checkSizeMin?: number | null;
  checkSizeMax?: number | null;
}

interface ClientProfile {
  companyName: string | null;
  oneLiner: string | null;
  sector: string | null;
  subSectors: string[] | null;
  technology: {
    core: string | null;
    description: string | null;
    differentiators: string[] | null;
  } | null;
  product: {
    type: string | null;
    offerings: string[] | null;
    description: string | null;
  } | null;
  businessModel: {
    type: string | null;
    revenueModel: string | null;
    description: string | null;
  } | null;
  targetMarket: {
    industries: string[] | null;
    customerProfile: string | null;
    geographicFocus: string | null;
  } | null;
  stage: {
    estimated: string | null;
    signals: string[] | null;
  } | null;
  team: {
    founders: string[] | null;
    size: string | null;
    location: string | null;
  } | null;
  traction: {
    customers: string[] | null;
    milestones: string[] | null;
  } | null;
  investorFitKeywords: string[] | null;
}

interface ClientCriteria {
  clientName: string;
  clientWebsite: string;
  sectors: string[];
  customSectors: string[];
  checkSize: number;
  stages: string[];
  geoFocus: string[];
  isHardware: boolean;
  screenedBy: string;
  userEmail: string;
}

interface ScreeningProgress {
  current: number;
  total: number;
  currentInvestor: string;
}

type SortKey = 'investorName' | 'relevanceScore' | 'screenedAt' | 'verdict';
type SortDirection = 'asc' | 'desc';

const SECTOR_OPTIONS = [
  { value: 'agritech', label: 'AgriTech' },
  { value: 'climate', label: 'Climate' },
  { value: 'robotics', label: 'Robotics' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'ai', label: 'AI / ML' },
  { value: 'saas', label: 'SaaS' },
  { value: 'fintech', label: 'FinTech' },
  { value: 'healthtech', label: 'HealthTech' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'defense', label: 'Defense' },
  { value: 'biotech', label: 'Biotech' },
  { value: 'energy', label: 'Energy' },
  { value: 'batteries', label: 'Batteries' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'spacetech', label: 'SpaceTech' },
  { value: 'foodtech', label: 'FoodTech' },
  { value: 'proptech', label: 'PropTech' },
  { value: 'edtech', label: 'EdTech' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'deeptech', label: 'DeepTech' },
];

const STAGE_OPTIONS = [
  { value: 'Pre-seed', label: 'Pre-seed' },
  { value: 'Seed', label: 'Seed' },
  { value: 'Series A', label: 'Series A' },
  { value: 'Series B', label: 'Series B' },
  { value: 'Series C', label: 'Series C' },
  { value: 'Series D', label: 'Series D' },
  { value: 'Growth', label: 'Growth' },
];

const GEO_OPTIONS = [
  // Regions
  { value: 'usa', label: 'USA' },
  { value: 'europe', label: 'Europe (all)' },
  { value: 'uk', label: 'UK' },
  // EU - Western
  { value: 'germany', label: 'Germany' },
  { value: 'france', label: 'France' },
  { value: 'netherlands', label: 'Netherlands' },
  { value: 'belgium', label: 'Belgium' },
  { value: 'luxembourg', label: 'Luxembourg' },
  { value: 'austria', label: 'Austria' },
  { value: 'ireland', label: 'Ireland' },
  // EU - Southern
  { value: 'spain', label: 'Spain' },
  { value: 'italy', label: 'Italy' },
  { value: 'portugal', label: 'Portugal' },
  { value: 'greece', label: 'Greece' },
  { value: 'malta', label: 'Malta' },
  { value: 'cyprus', label: 'Cyprus' },
  // EU - Nordics
  { value: 'sweden', label: 'Sweden' },
  { value: 'denmark', label: 'Denmark' },
  { value: 'finland', label: 'Finland' },
  // EU - Eastern
  { value: 'poland', label: 'Poland' },
  { value: 'czechia', label: 'Czechia' },
  { value: 'slovakia', label: 'Slovakia' },
  { value: 'hungary', label: 'Hungary' },
  { value: 'romania', label: 'Romania' },
  { value: 'bulgaria', label: 'Bulgaria' },
  { value: 'croatia', label: 'Croatia' },
  { value: 'slovenia', label: 'Slovenia' },
  // EU - Baltics
  { value: 'estonia', label: 'Estonia' },
  { value: 'latvia', label: 'Latvia' },
  { value: 'lithuania', label: 'Lithuania' },
  // Non-EU Europe
  { value: 'switzerland', label: 'Switzerland' },
  { value: 'norway', label: 'Norway' },
  { value: 'iceland', label: 'Iceland' },
  { value: 'ukraine', label: 'Ukraine' },
  { value: 'serbia', label: 'Serbia' },
  // Other
  { value: 'israel', label: 'Israel' },
  { value: 'canada', label: 'Canada' },
];

// Expandable Field Component - label on top, content in box below
function ExpandableProfileField({ 
  label, 
  value, 
  onChange, 
  placeholder = ''
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const displayValue = value.length > 80 ? value.slice(0, 80) + '...' : value;
  
  return (
    <div className="bg-[#2C3E56]/30 rounded-lg px-3 py-2">
      <div 
        className="flex items-center gap-1 mb-1 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="material-symbols-sharp text-sm text-[#989CA3]">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
        <label className="text-[#989CA3] text-xs">{label}</label>
      </div>
      
      {isExpanded ? (
        <div onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              placeholder={placeholder}
              autoFocus
              className="w-full px-2 py-1.5 bg-[#2C3E56] border border-[#989CA3] rounded text-[#FBFAF8] text-sm focus:outline-none resize-none"
              style={{ minHeight: '60px', height: 'auto' }}
              rows={Math.max(2, Math.ceil(value.length / 50))}
            />
          ) : (
            <div 
              className="w-full px-2 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded text-[#FBFAF8] text-sm cursor-text hover:border-[#989CA3] transition-colors whitespace-pre-wrap"
              onClick={() => setIsEditing(true)}
            >
              {value || <span className="text-[#989CA3] italic">{placeholder || 'Click to edit'}</span>}
            </div>
          )}
        </div>
      ) : (
        <div 
          className="w-full px-2 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded text-[#FBFAF8] text-sm truncate cursor-pointer"
          onClick={() => setIsExpanded(true)}
        >
          {displayValue || <span className="text-[#989CA3] italic">Empty</span>}
        </div>
      )}
    </div>
  );
}

// Loading Overlay Component
function LoadingOverlay({ progress }: { progress: ScreeningProgress }) {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  
  return (
    <div className="fixed inset-0 bg-[#192432] z-50 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center max-w-md px-8">
        {/* Logo */}
        <img 
          src="/evolute-logo.svg" 
          alt="Evolute" 
          className="h-16 w-auto mb-12 opacity-90"
        />
        
        {/* Progress bar */}
        <div className="w-full bg-[#2C3E56] rounded-full h-3 mb-6 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#FBFAF8] to-[#989CA3] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* Progress text */}
        <p className="text-[#989CA3] text-sm mb-2">
          Screening {progress.current} of {progress.total}
        </p>
        <p className="text-[#FBFAF8] text-lg font-medium mb-8 text-center">
          {progress.currentInvestor || 'Starting...'}
        </p>
        
        {/* Message */}
        <div className="text-center">
          <p className="text-[#FBFAF8] text-xl font-headline mb-4">
            Running your search.
          </p>
          <p className="text-[#989CA3] text-base leading-relaxed">
            I&apos;ll send you an email when your search is done.<br />
            See ya soon! 👋
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'screen' | 'results'>('screen');
  const [investorInput, setInvestorInput] = useState('');
  const [criteria, setCriteria] = useState<ClientCriteria>({
    clientName: '',
    clientWebsite: '',
    sectors: [],
    customSectors: [],
    checkSize: 5000000,
    stages: [],
    geoFocus: [],
    isHardware: false,
    screenedBy: '',
    userEmail: '',
  });
  const [customSectorInput, setCustomSectorInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [progress, setProgress] = useState<ScreeningProgress>({ current: 0, total: 0, currentInvestor: '' });
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [savedProfiles, setSavedProfiles] = useState<{clientName: string; updatedAt: string}[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('relevanceScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showClientMenu, setShowClientMenu] = useState(false);
  
  // Client profile analysis state
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [pagesAnalyzed, setPagesAnalyzed] = useState<number>(0);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  
  // Admin auth state
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    fetchClients();
    fetchSavedProfiles();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      setIsAdmin(data.authenticated);
    } catch {
      setIsAdmin(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginName, password: loginPassword }),
      });
      if (res.ok) {
        setIsAdmin(true);
        setShowLoginModal(false);
        setLoginName('');
        setLoginPassword('');
      } else {
        setLoginError('Invalid credentials');
      }
    } catch {
      setLoginError('Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      setIsAdmin(false);
    } catch {
      // Ignore
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowProfileMenu(false);
      setShowClientMenu(false);
    };
    if (showProfileMenu || showClientMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showProfileMenu, showClientMenu]);

  const fetchSavedProfiles = async () => {
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      setSavedProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  const clearForm = () => {
    setCriteria({
      clientName: '',
      clientWebsite: '',
      sectors: [],
      customSectors: [],
      checkSize: 5000000,
      stages: [],
      geoFocus: [],
      isHardware: false,
      screenedBy: criteria.screenedBy,
      userEmail: criteria.userEmail,
    });
    setInvestorInput('');
    setError(null);
    setClientProfile(null);
    setAnalysisError(null);
    setPagesAnalyzed(0);
  };

  const analyzeClient = async () => {
    if (!criteria.clientWebsite.trim()) {
      setAnalysisError('Please enter a client website first');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    setClientProfile(null);
    
    try {
      const keywords = [...criteria.sectors, ...criteria.customSectors];
      const res = await fetch('/api/analyze-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientWebsite: criteria.clientWebsite,
          keywords 
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }
      
      const data = await res.json();
      setClientProfile(data.profile);
      setPagesAnalyzed(data.pagesAnalyzed);
      
      // Auto-fill client name if empty
      if (!criteria.clientName && data.profile.companyName) {
        setCriteria(prev => ({ ...prev, clientName: data.profile.companyName }));
      }
      
      setShowProfileEditor(true);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadProfile = async (clientName: string) => {
    try {
      const res = await fetch(`/api/profiles?name=${encodeURIComponent(clientName)}`);
      if (res.ok) {
        const profile = await res.json();
        setCriteria({
          clientName: profile.clientName,
          clientWebsite: profile.clientWebsite || '',
          sectors: profile.sectors || [],
          customSectors: profile.customSectors || [],
          checkSize: profile.checkSize || 5000000,
          stages: profile.stages || [],
          geoFocus: profile.geoFocus || [],
          isHardware: profile.isHardware || false,
          screenedBy: criteria.screenedBy,
          userEmail: criteria.userEmail,
        });
        if (profile.investorInput) {
          setInvestorInput(profile.investorInput);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const saveProfile = async () => {
    if (!criteria.clientName) return;
    try {
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...criteria, investorInput }),
      });
      fetchSavedProfiles();
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const deleteProfile = async (clientName: string) => {
    if (!confirm(`Delete saved search "${clientName}"?`)) return;
    try {
      await fetch(`/api/profiles?name=${encodeURIComponent(clientName)}`, {
        method: 'DELETE',
      });
      fetchSavedProfiles();
      // Clear form if we just deleted the currently loaded profile
      if (criteria.clientName === clientName) {
        clearForm();
      }
    } catch (err) {
      console.error('Error deleting profile:', err);
    }
  };

  const deleteClientResults = async (clientName: string) => {
    if (!confirm(`Delete all screening results for "${clientName}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/results?client=${encodeURIComponent(clientName)}`, {
        method: 'DELETE',
      });
      fetchClients();
      fetchResults();
      if (selectedClient === clientName) {
        setSelectedClient('');
      }
    } catch (err) {
      console.error('Error deleting results:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'results') {
      fetchResults();
    }
  }, [activeTab, selectedClient]);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/results?client=__clients__');
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchResults = async () => {
    try {
      const url = selectedClient 
        ? `/api/results?client=${encodeURIComponent(selectedClient)}`
        : '/api/results';
      const res = await fetch(url);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching results:', err);
    }
  };

  const parseInvestorInput = (input: string) => {
    // Pre-process: merge continuation lines (lines that start with URL or look incomplete)
    const rawLines = input.trim().split('\n').filter(line => line.trim());
    const mergedLines: string[] = [];
    
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      const prevLine = mergedLines.length > 0 ? mergedLines[mergedLines.length - 1] : '';
      
      // Check if this line looks like a continuation (starts with URL or country, not a full entry)
      const looksLikeUrl = /^(www\.|http|[a-z0-9-]+\.(com|net|org|io|vc|co|fund|capital|ventures|partners))/.test(line.toLowerCase());
      const looksLikeCountry = /^(usa|uk|norway|germany|france|netherlands|switzerland|sweden|denmark|finland|spain|italy|austria|belgium|ireland|portugal|israel|canada|australia|singapore|japan|china|india|brazil|mexico|united)/i.test(line);
      const prevEndsWithComma = prevLine.endsWith(',');
      const prevFieldCount = prevLine.split(/[,\t]/).length;
      
      // Merge if previous line seems incomplete and this looks like a continuation
      if (mergedLines.length > 0 && (looksLikeUrl || looksLikeCountry) && (prevEndsWithComma || prevFieldCount < 3)) {
        mergedLines[mergedLines.length - 1] = prevLine + (prevEndsWithComma ? ' ' : ', ') + line;
      } else {
        mergedLines.push(line);
      }
    }
    
    const lines = mergedLines.filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const firstLine = lines[0].toLowerCase();
    const hasHeaders = firstLine.includes('name') || firstLine.includes('website') || firstLine.includes('hq') || firstLine.includes('investor');
    
    let nameIdx = 0, websiteIdx = 1, hqIdx = 2;
    if (hasHeaders) {
      const headers = firstLine.split(/[,\t]/).map(h => h.trim().replace(/^["']|["']$/g, ''));
      headers.forEach((h, i) => {
        if (h.includes('name') || h.includes('investor')) nameIdx = i;
        else if (h.includes('website') || h.includes('url') || h.includes('site')) websiteIdx = i;
        else if (h.includes('hq') || h.includes('location') || h.includes('country') || h.includes('geo')) hqIdx = i;
      });
    }
    
    const dataLines = hasHeaders ? lines.slice(1) : lines;
    
    return dataLines.map(line => {
      const parts = line.split(/[,\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
      let name = parts[nameIdx] || '';
      let website = parts[websiteIdx] || '';
      let hq = parts[hqIdx] || '';
      
      const countries = ['usa', 'uk', 'united', 'germany', 'france', 'netherlands', 'switzerland', 'israel', 'spain', 'italy', 'sweden', 'japan', 'china', 'india', 'canada', 'australia', 'singapore', 'belgium', 'austria', 'denmark', 'norway', 'finland', 'ireland', 'portugal', 'poland', 'czech', 'hungary', 'romania', 'greece', 'brazil', 'mexico', 'argentina', 'chile', 'colombia', 'korea', 'taiwan', 'hong kong', 'thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines', 'new zealand', 'south africa', 'nigeria', 'kenya', 'egypt', 'uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'jordan', 'lebanon', 'turkey', 'russia', 'ukraine', 'estonia', 'latvia', 'lithuania', 'luxembourg'];
      const websiteLower = website.toLowerCase();
      const hqLower = hq.toLowerCase();
      
      const websiteLooksLikeCountry = countries.some(c => websiteLower.includes(c)) || websiteLower === 'kingdom';
      const hqLooksLikeUrl = hqLower.includes('.') && (hqLower.includes('.com') || hqLower.includes('.io') || hqLower.includes('.vc') || hqLower.includes('.co') || hqLower.includes('.fund') || hqLower.includes('.ch') || hqLower.includes('.de') || hqLower.includes('.fr') || hqLower.includes('.uk') || hqLower.includes('.nl') || hqLower.includes('.do') || hqLower.includes('www.'));
      
      if (websiteLooksLikeCountry && hqLooksLikeUrl) {
        [website, hq] = [hq, website];
      }
      
      return { name, website, hq };
    }).filter(inv => inv.name);
  };

  const handleScreen = async () => {
    if (!criteria.clientName.trim()) {
      setError('Please enter a client name');
      return;
    }
    
    if (!criteria.userEmail.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    const investors = parseInvestorInput(investorInput);
    if (investors.length === 0) {
      setError('Please enter at least one investor');
      return;
    }
    
    setIsScreening(true);
    setError(null);
    setProgress({ current: 0, total: investors.length, currentInvestor: 'Starting...' });
    
    try {
      await saveProfile();
      
      const res = await fetch('/api/screen-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investors, criteria, clientProfile }),
      });
      
      if (!res.ok) throw new Error('Screening failed');
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      let finalResults: ScreeningResult[] = [];
      let summary = { qualified: 0, disqualified: 0, needsReview: 0, total: 0 };
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setProgress({
                  current: data.current,
                  total: data.total,
                  currentInvestor: data.investor,
                });
              } else if (data.type === 'complete') {
                finalResults = data.results.map((r: Record<string, unknown>, idx: number) => ({
                  id: idx,
                  investorName: r.investor_name,
                  website: r.website,
                  hq: r.hq,
                  verdict: r.verdict,
                  relevanceScore: r.relevance_score,
                  reasoning: r.reasoning,
                  industryFocus: r.industry_focus,
                  clientName: criteria.clientName,
                  screenedAt: new Date().toISOString(),
                  checkSizeMin: r.check_size_min as number | null,
                  checkSizeMax: r.check_size_max as number | null,
                }));
                summary = data.summary;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
      
      // Send email notification
      if (criteria.userEmail) {
        try {
          await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: criteria.userEmail,
              clientName: criteria.clientName,
              qualified: summary.qualified,
              disqualified: summary.disqualified,
              needsReview: summary.needsReview,
              total: summary.total,
            }),
          });
        } catch (emailErr) {
          console.error('Email failed:', emailErr);
        }
      }
      
      setResults(finalResults);
      fetchClients();
      setSelectedClient(criteria.clientName);
      setActiveTab('results');
    } catch (err) {
      setError('Failed to screen investors. Please try again.');
      console.error(err);
    } finally {
      setIsScreening(false);
    }
  };

  const handleExport = () => {
    const url = selectedClient 
      ? `/api/export?client=${encodeURIComponent(selectedClient)}`
      : '/api/export';
    window.open(url, '_blank');
  };

  const toggleArrayValue = (arr: string[], value: string): string[] => {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
  };

  const getVerdictStyle = (verdict: string) => {
    const v = verdict.toLowerCase();
    if (v === 'qualified: lead' || v === 'qualified') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (v === 'qualified: co-lead') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    if (v === 'disqualified') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    if (v.startsWith('needs review')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-emerald-400';
    if (score <= 3) return 'text-rose-400';
    return 'text-amber-400';
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'investorName' ? 'asc' : 'desc');
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortKey) {
      case 'investorName':
        return multiplier * a.investorName.localeCompare(b.investorName);
      case 'relevanceScore':
        return multiplier * (a.relevanceScore - b.relevanceScore);
      case 'screenedAt':
        return multiplier * (new Date(a.screenedAt).getTime() - new Date(b.screenedAt).getTime());
      case 'verdict':
        const getVerdictOrder = (v: string) => {
          const lower = v.toLowerCase();
          if (lower === 'qualified') return 3;
          if (lower.startsWith('needs review')) return 2;
          return 1; // disqualified
        };
        return multiplier * (getVerdictOrder(a.verdict) - getVerdictOrder(b.verdict));
      default:
        return 0;
    }
  });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span className="opacity-30">↕</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <main className="min-h-screen">
      {/* Loading Overlay */}
      {isScreening && <LoadingOverlay progress={progress} />}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 sm:mb-12">
          <div className="flex items-center gap-3 sm:gap-6">
            <img src="/evolute-logo.svg" alt="Evolute" className="h-5 sm:h-6 w-auto text-[#FBFAF8]" style={{ color: '#FBFAF8' }} />
            <div className="h-5 sm:h-6 w-px bg-[#2C3E56]" />
            <h1 className="font-headline text-lg sm:text-xl text-[#FBFAF8]">Investor screener</h1>
          </div>
          <div>
            {isAdmin ? (
              <div className="flex items-center gap-3">
                <a 
                  href="/admin" 
                  className="px-4 py-2 rounded-lg bg-[#2C3E56] text-[#989CA3] hover:text-[#FBFAF8] text-sm transition-colors"
                >
                  Admin
                </a>
                <button
                  onClick={handleLogout}
                  className="text-[#989CA3] hover:text-[#FBFAF8] text-sm transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 rounded-lg bg-[#2C3E56] text-[#989CA3] hover:text-[#FBFAF8] text-sm transition-colors"
              >
                Admin Login
              </button>
            )}
          </div>
        </header>

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowLoginModal(false)}>
            <div className="bg-[#1E2D3D] rounded-xl p-6 w-full max-w-sm border border-[#2C3E56]" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-medium text-[#FBFAF8] mb-4">Admin Login</h2>
              <form onSubmit={handleLogin}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#989CA3] text-sm mb-1.5">Name</label>
                    <input
                      type="text"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#2C3E56] border border-[#2C3E56] text-[#FBFAF8] focus:outline-none focus:border-[#989CA3]"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[#989CA3] text-sm mb-1.5">Password</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#2C3E56] border border-[#2C3E56] text-[#FBFAF8] focus:outline-none focus:border-[#989CA3]"
                    />
                  </div>
                  {loginError && (
                    <p className="text-rose-400 text-sm">{loginError}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 rounded-lg bg-[#FBFAF8] text-[#192432] font-medium text-sm hover:bg-white transition-colors"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(false)}
                      className="px-4 py-2.5 rounded-lg bg-[#2C3E56] text-[#989CA3] text-sm hover:text-[#FBFAF8] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-[#1F2C3D] rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('screen')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'screen'
                ? 'bg-[#FBFAF8] text-[#192432]'
                : 'text-[#989CA3] hover:text-[#FBFAF8]'
            }`}
          >
            Screen investors
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'results'
                ? 'bg-[#FBFAF8] text-[#192432]'
                : 'text-[#989CA3] hover:text-[#FBFAF8]'
            }`}
          >
            Results
          </button>
        </div>

        {activeTab === 'screen' && (
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-8">
            {/* Left Column: Investors + Your Details */}
            <div className="space-y-6">
              {/* Investor Input */}
              <div className="bg-[#1F2C3D]/50 rounded-2xl p-6 border border-[#2C3E56]">
                <h2 className="font-headline text-lg text-[#FBFAF8] mb-1">Investors</h2>
                <p className="text-[#989CA3] text-sm mb-4">
                  Paste investor list or drag & drop a CSV file
                </p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file && file.name.endsWith('.csv')) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setInvestorInput(ev.target?.result as string);
                      reader.readAsText(file);
                    }
                  }}
                  className={`relative ${isDragging ? 'ring-2 ring-[#989CA3]' : ''}`}
                >
                  {isDragging && (
                    <div className="absolute inset-0 bg-[#2C3E56]/50 rounded-lg flex items-center justify-center z-10">
                      <span className="text-[#FBFAF8] font-medium">Drop CSV file here</span>
                    </div>
                  )}
                  <textarea
                    value={investorInput}
                    onChange={(e) => setInvestorInput(e.target.value)}
                    placeholder={`Name, Website, HQ
Sequoia Capital, sequoiacap.com, USA
Accel, accel.com, USA`}
                    className="w-full h-52 px-4 py-3 bg-[#2C3E56] border border-[#2C3E56] rounded-lg text-[#FBFAF8] placeholder-[#B7BABE] focus:outline-none focus:border-[#989CA3] font-mono text-sm resize-none"
                  />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[#989CA3] text-sm">
                    {parseInvestorInput(investorInput).length} investors detected
                  </p>
                  <label className="text-[#989CA3] text-sm cursor-pointer hover:text-[#FBFAF8] transition-colors">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setInvestorInput(ev.target?.result as string);
                          reader.readAsText(file);
                        }
                      }}
                    />
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-sharp text-base">upload_file</span>
                      Upload CSV
                    </span>
                  </label>
                </div>
              </div>

              {/* Your Details */}
              <div className="bg-[#1F2C3D]/50 rounded-2xl p-6 border border-[#2C3E56]">
                <h2 className="font-headline text-lg text-[#FBFAF8] mb-4">Your details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#989CA3] text-sm mb-2">Your name</label>
                    <input
                      type="text"
                      value={criteria.screenedBy}
                      onChange={(e) => setCriteria({ ...criteria, screenedBy: e.target.value })}
                      placeholder="Your name"
                      className="w-full px-4 py-2.5 bg-[#2C3E56] border border-[#2C3E56] rounded-lg text-[#FBFAF8] placeholder-[#B7BABE] focus:outline-none focus:border-[#989CA3]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#989CA3] text-sm mb-2">Your email <span className="text-rose-400">*</span></label>
                    <input
                      type="email"
                      value={criteria.userEmail}
                      onChange={(e) => setCriteria({ ...criteria, userEmail: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2.5 bg-[#2C3E56] border border-[#2C3E56] rounded-lg text-[#FBFAF8] placeholder-[#B7BABE] focus:outline-none focus:border-[#989CA3]"
                    />
                    <p className="text-[#989CA3] text-xs mt-1">We&apos;ll email you when screening is complete</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Client Criteria */}
            <div className="bg-[#1F2C3D]/50 rounded-2xl p-6 border border-[#2C3E56]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline text-lg text-[#FBFAF8]">Client criteria</h2>
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="px-3 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded-lg text-[#989CA3] text-sm hover:border-[#989CA3] flex items-center gap-2"
                  >
                    {criteria.clientName || 'Select...'}
                    <span className="text-xs">▼</span>
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-[#2C3E56] border border-[#3D4F63] rounded-lg shadow-lg z-20 overflow-hidden">
                      <button
                        onClick={() => { clearForm(); setShowProfileMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-[#FBFAF8] hover:bg-[#3D4F63] flex items-center gap-2"
                      >
                        ✨ New search
                      </button>
                      {savedProfiles.length > 0 && (
                        <>
                          <div className="border-t border-[#3D4F63] my-1" />
                          <div className="px-4 py-1.5 text-xs text-[#989CA3] uppercase tracking-wide">Saved searches</div>
                          {savedProfiles.map(p => (
                            <div key={p.clientName} className="flex items-center hover:bg-[#3D4F63] group">
                              <button
                                onClick={() => { loadProfile(p.clientName); setShowProfileMenu(false); }}
                                className="flex-1 px-4 py-2 text-left text-sm text-[#FBFAF8]"
                              >
                                {p.clientName}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteProfile(p.clientName); }}
                                className="px-3 py-2 text-[#989CA3] hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-5">
                {/* Client Name */}
                <div>
                  <label className="block text-[#989CA3] text-sm mb-2">Client name</label>
                  <input
                    type="text"
                    value={criteria.clientName}
                    onChange={(e) => setCriteria({ ...criteria, clientName: e.target.value })}
                    placeholder="Client name"
                    className="w-full px-4 py-2.5 bg-[#2C3E56] border border-[#2C3E56] rounded-lg text-[#FBFAF8] placeholder-[#B7BABE] focus:outline-none focus:border-[#989CA3]"
                  />
                </div>

                {/* Client Website */}
                <div>
                  <label className="block text-[#989CA3] text-sm mb-2">Client website</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={criteria.clientWebsite}
                      onChange={(e) => setCriteria({ ...criteria, clientWebsite: e.target.value })}
                      placeholder="website.com"
                      className="flex-1 px-4 py-2.5 bg-[#2C3E56] border border-[#2C3E56] rounded-lg text-[#FBFAF8] placeholder-[#B7BABE] focus:outline-none focus:border-[#989CA3]"
                    />
                    <button
                      onClick={analyzeClient}
                      disabled={isAnalyzing || !criteria.clientWebsite.trim()}
                      className={`px-4 py-2.5 font-medium rounded-lg text-sm transition-all whitespace-nowrap ${
                        clientProfile 
                          ? 'bg-[#2C3E56] border border-[#989CA3]/50 text-[#FBFAF8] hover:border-[#989CA3]' 
                          : 'bg-[#FBFAF8] hover:bg-white text-[#192432] disabled:bg-[#2C3E56] disabled:text-[#989CA3]'
                      }`}
                    >
                      {isAnalyzing ? 'Analyzing...' : clientProfile ? 'Re-analyze' : 'Analyze'}
                    </button>
                  </div>
                  {analysisError && (
                    <p className="text-rose-400 text-sm mt-2">{analysisError}</p>
                  )}
                </div>

                {/* Client Profile Display */}
                {clientProfile && (
                  <div className="bg-[#243346] rounded-xl p-4 border border-[#3D4F63]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[#FBFAF8] font-medium flex items-center gap-2">
                        Client Profile Analyzed
                        <span className="text-[#989CA3] text-xs font-normal">({pagesAnalyzed} pages)</span>
                      </h3>
                      <button
                        onClick={() => setShowProfileEditor(!showProfileEditor)}
                        className="text-[#989CA3] hover:text-[#FBFAF8] text-sm"
                      >
                        {showProfileEditor ? 'Hide' : 'View/Edit'}
                      </button>
                    </div>
                    
                    {!showProfileEditor && (
                      <div className="text-[#989CA3] text-sm">
                        <span className="text-[#FBFAF8]">{clientProfile.companyName}</span>
                        {clientProfile.oneLiner && <span> — {clientProfile.oneLiner}</span>}
                      </div>
                    )}
                    
                    {showProfileEditor && (
                      <div className="space-y-2 mt-4">
                        {/* One-liner - Expandable */}
                        <ExpandableProfileField
                          label="One-liner"
                          value={clientProfile.oneLiner || ''}
                          onChange={(val) => setClientProfile({ ...clientProfile, oneLiner: val })}
                        />
                        
                        {/* Sector & Sub-sectors - Side by side, always visible */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="bg-[#2C3E56]/30 rounded-lg px-3 py-2">
                            <label className="block text-[#989CA3] text-xs mb-1">Sector</label>
                            <input
                              type="text"
                              value={clientProfile.sector || ''}
                              onChange={(e) => setClientProfile({ ...clientProfile, sector: e.target.value })}
                              className="w-full px-2 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded text-[#FBFAF8] text-sm focus:outline-none focus:border-[#989CA3]"
                            />
                          </div>
                          <div className="bg-[#2C3E56]/30 rounded-lg px-3 py-2">
                            <label className="block text-[#989CA3] text-xs mb-1">Product type</label>
                            <input
                              type="text"
                              value={clientProfile.product?.type || ''}
                              onChange={(e) => setClientProfile({ 
                                ...clientProfile, 
                                product: { ...clientProfile.product!, type: e.target.value }
                              })}
                              className="w-full px-2 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded text-[#FBFAF8] text-sm focus:outline-none focus:border-[#989CA3]"
                            />
                          </div>
                        </div>
                        
                        {/* Sub-sectors - Expandable */}
                        <ExpandableProfileField
                          label="Sub-sectors"
                          value={clientProfile.subSectors?.join(', ') || ''}
                          onChange={(val) => setClientProfile({ ...clientProfile, subSectors: val.split(',').map(s => s.trim()).filter(Boolean) })}
                          placeholder="comma separated"
                        />
                        
                        {/* Technology - Expandable */}
                        {clientProfile.technology && (
                          <ExpandableProfileField
                            label="Technology"
                            value={clientProfile.technology.description || ''}
                            onChange={(val) => setClientProfile({ 
                              ...clientProfile, 
                              technology: { ...clientProfile.technology!, description: val }
                            })}
                          />
                        )}
                        
                        {/* Business model & Stage - Side by side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="bg-[#2C3E56]/30 rounded-lg px-3 py-2">
                            <label className="block text-[#989CA3] text-xs mb-1">Business model</label>
                            <input
                              type="text"
                              value={clientProfile.businessModel?.type || ''}
                              onChange={(e) => setClientProfile({ 
                                ...clientProfile, 
                                businessModel: { ...clientProfile.businessModel!, type: e.target.value }
                              })}
                              className="w-full px-2 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded text-[#FBFAF8] text-sm focus:outline-none focus:border-[#989CA3]"
                            />
                          </div>
                          <div className="bg-[#2C3E56]/30 rounded-lg px-3 py-2">
                            <label className="block text-[#989CA3] text-xs mb-1">Estimated stage</label>
                            <input
                              type="text"
                              value={clientProfile.stage?.estimated || ''}
                              onChange={(e) => setClientProfile({ 
                                ...clientProfile, 
                                stage: { ...clientProfile.stage!, estimated: e.target.value }
                              })}
                              className="w-full px-2 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded text-[#FBFAF8] text-sm focus:outline-none focus:border-[#989CA3]"
                            />
                          </div>
                        </div>
                        
                        {/* Target industries - Expandable */}
                        {clientProfile.targetMarket && (
                          <ExpandableProfileField
                            label="Target industries"
                            value={clientProfile.targetMarket.industries?.join(', ') || ''}
                            onChange={(val) => setClientProfile({ 
                              ...clientProfile, 
                              targetMarket: { ...clientProfile.targetMarket!, industries: val.split(',').map(s => s.trim()).filter(Boolean) }
                            })}
                            placeholder="comma separated"
                          />
                        )}
                        
                        {/* HQ Location - Simple field */}
                        <div className="bg-[#2C3E56]/30 rounded-lg px-3 py-2">
                          <label className="block text-[#989CA3] text-xs mb-1">HQ Location</label>
                          <input
                            type="text"
                            value={clientProfile.team?.location || ''}
                            onChange={(e) => setClientProfile({ 
                              ...clientProfile, 
                              team: { ...clientProfile.team!, location: e.target.value }
                            })}
                            className="w-full px-2 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded text-[#FBFAF8] text-sm focus:outline-none focus:border-[#989CA3]"
                          />
                        </div>
                        
                        {/* Investor Fit Keywords - Expandable */}
                        <ExpandableProfileField
                          label="Investor fit keywords"
                          value={clientProfile.investorFitKeywords?.join(', ') || ''}
                          onChange={(val) => setClientProfile({ 
                            ...clientProfile, 
                            investorFitKeywords: val.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="comma separated keywords for matching"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Sectors */}
                <div>
                  <label className="block text-[#989CA3] text-sm mb-2">Sector / vertical key words</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {SECTOR_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setCriteria({ ...criteria, sectors: toggleArrayValue(criteria.sectors, opt.value) })}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all border ${
                          criteria.sectors.includes(opt.value)
                            ? 'bg-[#FBFAF8] text-[#192432] border-[#FBFAF8]'
                            : 'bg-transparent text-[#989CA3] border-[#2C3E56] hover:border-[#989CA3]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {criteria.customSectors.map(sector => (
                      <button
                        key={sector}
                        onClick={() => setCriteria({ ...criteria, customSectors: criteria.customSectors.filter(s => s !== sector) })}
                        className="px-3 py-1.5 rounded-full text-sm bg-[#FBFAF8] text-[#192432] border border-[#FBFAF8] flex items-center gap-1"
                      >
                        {sector}
                        <span className="text-[#989CA3]">×</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSectorInput}
                      onChange={(e) => setCustomSectorInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customSectorInput.trim()) {
                          e.preventDefault();
                          const newSector = customSectorInput.trim().toLowerCase();
                          if (!criteria.customSectors.includes(newSector) && !criteria.sectors.includes(newSector)) {
                            setCriteria({ ...criteria, customSectors: [...criteria.customSectors, newSector] });
                          }
                          setCustomSectorInput('');
                        }
                      }}
                      placeholder="Add custom keyword..."
                      className="flex-1 px-3 py-2 bg-[#2C3E56] border border-[#2C3E56] rounded-lg text-[#FBFAF8] placeholder-[#B7BABE] text-sm focus:outline-none focus:border-[#989CA3]"
                    />
                    <button
                      onClick={() => {
                        if (customSectorInput.trim()) {
                          const newSector = customSectorInput.trim().toLowerCase();
                          if (!criteria.customSectors.includes(newSector) && !criteria.sectors.includes(newSector)) {
                            setCriteria({ ...criteria, customSectors: [...criteria.customSectors, newSector] });
                          }
                          setCustomSectorInput('');
                        }
                      }}
                      className="px-4 py-2 bg-[#2C3E56] hover:bg-[#28394F] text-[#FBFAF8] rounded-lg text-sm transition-all"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Check Size */}
                <div>
                  <label className="block text-[#989CA3] text-sm mb-2">
                    Check size: €{(() => {
                      const millions = criteria.checkSize / 1000000;
                      const decimal = millions % 1;
                      if (decimal === 0.5) return millions.toFixed(1);
                      return Math.round(millions);
                    })()}M
                  </label>
                  <input
                    type="range"
                    min={500000}
                    max={50000000}
                    step={500000}
                    value={criteria.checkSize}
                    onChange={(e) => setCriteria({ ...criteria, checkSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Stages */}
                <div>
                  <label className="block text-[#989CA3] text-sm mb-2">Target stages</label>
                  <div className="flex flex-wrap gap-2">
                    {STAGE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setCriteria({ ...criteria, stages: toggleArrayValue(criteria.stages, opt.value) })}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all border ${
                          criteria.stages.includes(opt.value)
                            ? 'bg-[#FBFAF8] text-[#192432] border-[#FBFAF8]'
                            : 'bg-transparent text-[#989CA3] border-[#2C3E56] hover:border-[#989CA3]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Geography */}
                <div>
                  <label className="block text-[#989CA3] text-sm mb-2">Client location</label>
                  <div className="flex flex-wrap gap-2">
                    {GEO_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setCriteria({ ...criteria, geoFocus: toggleArrayValue(criteria.geoFocus, opt.value) })}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all border ${
                          criteria.geoFocus.includes(opt.value)
                            ? 'bg-[#FBFAF8] text-[#192432] border-[#FBFAF8]'
                            : 'bg-transparent text-[#989CA3] border-[#2C3E56] hover:border-[#989CA3]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hardware Toggle */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setCriteria({ ...criteria, isHardware: !criteria.isHardware })}
                      className={`w-11 h-6 rounded-full transition-all relative ${
                        criteria.isHardware ? 'bg-[#FBFAF8]' : 'bg-[#2C3E56]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full transition-all absolute top-1 ${
                          criteria.isHardware ? 'bg-[#192432] left-6' : 'bg-[#989CA3] left-1'
                        }`}
                      />
                    </div>
                    <span className="text-[#FBFAF8] text-sm">Hardware company</span>
                  </label>
                </div>

                {error && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleScreen}
                  disabled={isScreening}
                  className="w-full py-3 bg-[#FBFAF8] hover:bg-[#EAEAEB] disabled:bg-[#2C3E56] disabled:text-[#989CA3] text-[#192432] font-medium rounded-lg transition-all"
                >
                  {isScreening ? 'Screening...' : 'Screen investors'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="bg-[#1F2C3D]/50 rounded-2xl p-4 sm:p-6 border border-[#2C3E56]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h2 className="font-headline text-lg text-[#FBFAF8]">Screening results</h2>
                {clients.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowClientMenu(!showClientMenu); }}
                      className="px-3 py-1.5 bg-[#2C3E56] border border-[#2C3E56] rounded-lg text-[#FBFAF8] text-sm hover:border-[#989CA3] flex items-center gap-2"
                    >
                      {selectedClient || 'All clients'}
                      <span className="text-xs">▼</span>
                    </button>
                    {showClientMenu && (
                      <div className="absolute left-0 top-full mt-1 w-64 bg-[#2C3E56] border border-[#3D4F63] rounded-lg shadow-lg z-20 overflow-hidden">
                        <button
                          onClick={() => { setSelectedClient(''); setShowClientMenu(false); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-[#FBFAF8] hover:bg-[#3D4F63]"
                        >
                          All clients
                        </button>
                        <div className="border-t border-[#3D4F63] my-1" />
                        {clients.map(c => (
                          <div key={c} className="flex items-center hover:bg-[#3D4F63] group">
                            <button
                              onClick={() => { setSelectedClient(c); setShowClientMenu(false); }}
                              className="flex-1 px-4 py-2 text-left text-sm text-[#FBFAF8]"
                            >
                              {c}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteClientResults(c); }}
                              className="px-3 py-2 text-[#989CA3] hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete all results"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-[#2C3E56] hover:bg-[#2C3E56] text-[#FBFAF8] rounded-lg text-sm transition-all"
              >
                <span className="material-symbols-sharp text-base">download</span>
                Export CSV
              </button>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16 text-[#989CA3]">
                No screening results yet. Screen some investors to see results here.
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header row - hidden on mobile */}
                <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 text-[#989CA3] text-sm font-medium">
                  <div 
                    className="col-span-3 cursor-pointer hover:text-[#FBFAF8] flex items-center gap-1"
                    onClick={() => handleSort('investorName')}
                  >
                    Investor <SortIcon column="investorName" />
                  </div>
                  <div className="col-span-2">Website</div>
                  <div className="col-span-1">HQ</div>
                  {!selectedClient && (
                    <div className="col-span-1">Client</div>
                  )}
                  <div 
                    className="col-span-2 cursor-pointer hover:text-[#FBFAF8] flex items-center gap-1"
                    onClick={() => handleSort('verdict')}
                  >
                    Verdict <SortIcon column="verdict" />
                  </div>
                  <div 
                    className="col-span-1 cursor-pointer hover:text-[#FBFAF8] flex items-center gap-1"
                    onClick={() => handleSort('relevanceScore')}
                  >
                    Score <SortIcon column="relevanceScore" />
                  </div>
                  <div 
                    className={`${selectedClient ? 'col-span-2' : 'col-span-1'} cursor-pointer hover:text-[#FBFAF8] flex items-center gap-1`}
                    onClick={() => handleSort('screenedAt')}
                  >
                    Screened <SortIcon column="screenedAt" />
                  </div>
                  <div className="col-span-1">Focus</div>
                </div>
                
                {/* Results */}
                {sortedResults.map((r) => (
                  <div key={r.id} className="bg-[#2C3E56]/30 rounded-lg overflow-hidden">
                    {/* Mobile view */}
                    <div 
                      className="lg:hidden px-4 py-3 cursor-pointer hover:bg-[#2C3E56]/50 transition-colors"
                      onClick={() => {
                        const newExpanded = new Set(expandedRows);
                        if (newExpanded.has(r.id)) {
                          newExpanded.delete(r.id);
                        } else {
                          newExpanded.add(r.id);
                        }
                        setExpandedRows(newExpanded);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="text-[#FBFAF8] font-medium flex items-center gap-2 flex-wrap">
                            <span className="material-symbols-sharp text-sm text-[#989CA3]">
                              {expandedRows.has(r.id) ? 'expand_less' : 'expand_more'}
                            </span>
                            {r.investorName}
                            {r.isRescreen && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                ×{r.screenCount}
                              </span>
                            )}
                          </div>
                          <div className="text-[#989CA3] text-xs mt-1">{r.website} • {r.hq}</div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border shrink-0 ${getVerdictStyle(r.verdict)}`}>
                          {r.verdict.toLowerCase().includes('qualified') ? '✓' : r.verdict.toLowerCase().includes('disqualified') ? '✗' : '?'}
                        </span>
                      </div>
                    </div>
                    {/* Desktop view */}
                    <div 
                      className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer hover:bg-[#2C3E56]/50 transition-colors items-center"
                      onClick={() => {
                        const newExpanded = new Set(expandedRows);
                        if (newExpanded.has(r.id)) {
                          newExpanded.delete(r.id);
                        } else {
                          newExpanded.add(r.id);
                        }
                        setExpandedRows(newExpanded);
                      }}
                    >
                      <div className="col-span-3 text-[#FBFAF8] font-medium flex items-center gap-2">
                        <span className="material-symbols-sharp text-sm text-[#989CA3]">
                          {expandedRows.has(r.id) ? 'expand_less' : 'expand_more'}
                        </span>
                        {r.investorName}
                        {r.isRescreen && (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            title={`Screened ${r.screenCount}x for this client`}
                          >
                            ×{r.screenCount}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-[#989CA3] text-sm truncate">
                        {r.website && (
                          <a
                            href={r.website.startsWith('http') ? r.website : `https://${r.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#FBFAF8] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.website}
                          </a>
                        )}
                      </div>
                      <div className="col-span-1 text-[#989CA3] text-sm truncate">{r.hq}</div>
                      {!selectedClient && (
                        <div className="col-span-1 text-[#989CA3] text-sm truncate" title={r.clientName}>{r.clientName}</div>
                      )}
                      <div className="col-span-2">
                        {(() => {
                          const v = r.verdict.toLowerCase();
                          const isNeedsReview = v.startsWith('needs review');
                          const isCoLead = v === 'qualified: co-lead';
                          const isLead = v === 'qualified: lead' || v === 'qualified';
                          const reason = isNeedsReview ? r.verdict.replace(/^needs review:?\s*/i, '') : null;
                          
                          let displayVerdict = 'Needs review';
                          if (isLead) displayVerdict = 'Qualified: Lead';
                          else if (isCoLead) displayVerdict = 'Qualified: Co-lead';
                          else if (v === 'disqualified') displayVerdict = 'Disqualified';
                          
                          // Format check size for co-lead
                          const formatCheckSize = () => {
                            if (!isCoLead || (!r.checkSizeMin && !r.checkSizeMax)) return null;
                            const formatVal = (v: number | null | undefined) => {
                              if (!v) return '?';
                              const millions = v / 1e6;
                              const decimal = millions % 1;
                              if (decimal === 0.5) return `€${millions.toFixed(1)}M`;
                              return `€${Math.round(millions)}M`;
                            };
                            return `ticket: ${formatVal(r.checkSizeMin)}-${formatVal(r.checkSizeMax)}`;
                          };
                          
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border w-fit ${getVerdictStyle(r.verdict)}`}>
                                {displayVerdict}
                              </span>
                              {reason && (
                                <span className="text-xs text-[#989CA3] pl-1 mt-0.5 italic">{reason.charAt(0).toUpperCase() + reason.slice(1)}</span>
                              )}
                              {isCoLead && formatCheckSize() && (
                                <span className="text-xs text-cyan-400/80 pl-1 mt-0.5">{formatCheckSize()}</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className={`col-span-1 font-semibold ${getScoreColor(r.relevanceScore)}`}>
                        {r.relevanceScore}/10
                      </div>
                      <div className={`${selectedClient ? 'col-span-2' : 'col-span-1'} text-[#989CA3] text-xs`}>
                        {formatDate(r.screenedAt)}
                      </div>
                      <div className="col-span-1 text-[#989CA3] text-sm truncate">{r.industryFocus}</div>
                    </div>
                    
                    {/* Expanded reasoning */}
                    {expandedRows.has(r.id) && (
                      <div className="px-4 py-3 bg-[#243346]/50 border-t border-[#2C3E56]">
                        <div className="text-[#989CA3] text-xs uppercase tracking-wide mb-1">Reasoning</div>
                        <div className="text-[#FBFAF8] text-sm leading-relaxed">{r.reasoning}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {results.length > 0 && (
              <div className="mt-6 pt-6 border-t border-[#2C3E56] flex gap-8">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-emerald-400">
                    {results.filter(r => r.verdict.toLowerCase() === 'qualified').length}
                  </div>
                  <div className="text-[#989CA3] text-sm">Qualified</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-rose-400">
                    {results.filter(r => r.verdict.toLowerCase() === 'disqualified').length}
                  </div>
                  <div className="text-[#989CA3] text-sm">Disqualified</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-amber-400">
                    {results.filter(r => r.verdict.toLowerCase().startsWith('needs review')).length}
                  </div>
                  <div className="text-[#989CA3] text-sm">Needs review</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
