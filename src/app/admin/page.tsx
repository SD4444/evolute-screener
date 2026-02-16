'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';

interface Investor {
  id: number;
  name: string;
  website: string | null;
  hq: string | null;
  sectors: string | null;
  check_size_min: number | null;
  check_size_max: number | null;
  stages: string | null;
  geo_focus: string | null;
  geographic_restrictions: string | null;
  geographic_exceptions: number;
  is_actual_investor: number | null;
  organization_type: string | null;
  portfolio_signals: string | null;
  enrichment_flags: string | null;
  description: string | null;
  last_enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

function formatCheckSize(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1000000) {
    const millions = value / 1000000;
    const decimal = millions % 1;
    // Only show decimal if it's .5
    if (decimal === 0.5) return `€${millions.toFixed(1)}M`;
    return `€${Math.round(millions)}M`;
  }
  if (value >= 1000) return `€${Math.round(value / 1000)}K`;
  return `€${value}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function TypeBadge({ type, isInvestor }: { type: string | null; isInvestor: number | null }) {
  // Distinct styles using brand colors - darker bg with light text
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    'vc': { bg: 'bg-[#3D5A80]', text: 'text-[#FBFAF8]', border: 'border-[#3D5A80]' },
    'cvc': { bg: 'bg-[#2C3E56]', text: 'text-[#FBFAF8]', border: 'border-[#4A6A8A]' },
    'pe': { bg: 'bg-[#4A6A8A]', text: 'text-[#FBFAF8]', border: 'border-[#5A7A9A]' },
    'angel': { bg: 'bg-[#3D5A80]/70', text: 'text-[#FBFAF8]', border: 'border-[#3D5A80]' },
    'family-office': { bg: 'bg-[#1F2C3D]', text: 'text-[#FBFAF8]', border: 'border-[#3D5A80]' },
    'accelerator': { bg: 'bg-transparent', text: 'text-[#989CA3]', border: 'border-[#3D5A80] border-dashed' },
    'incubator': { bg: 'bg-transparent', text: 'text-[#989CA3]', border: 'border-[#3D5A80] border-dashed' },
    'government': { bg: 'bg-[#192432]', text: 'text-[#B8BFC6]', border: 'border-[#2C3E56]' },
    'non-profit': { bg: 'bg-[#192432]', text: 'text-[#B8BFC6]', border: 'border-[#2C3E56]' },
  };
  
  const label = type === 'family-office' ? 'Family Office' : 
                type === 'non-profit' ? 'Non-profit' :
                type === 'vc' ? 'VC' :
                type === 'cvc' ? 'CVC' :
                type === 'pe' ? 'PE' :
                type ? capitalize(type) : 'Unknown';
  
  const style = styles[type || ''] || { bg: 'bg-[#2C3E56]', text: 'text-[#B8BFC6]', border: 'border-[#2C3E56]' };
  
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap ${style.bg} ${style.text} ${style.border} ${isInvestor === 0 ? 'opacity-50' : ''}`}>
      {label}
    </span>
  );
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function SectorPills({ sectors, expanded = false }: { sectors: string | null; expanded?: boolean }) {
  if (!sectors) return <span className="text-[#5A6A7A]">—</span>;
  
  const sectorList = sectors.split(',').map(s => capitalize(s.trim()));
  const displayCount = expanded ? sectorList.length : 2;
  const displayed = sectorList.slice(0, displayCount);
  const remaining = sectorList.length - displayCount;
  
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {displayed.map((sector, i) => (
        <span key={i} className="px-2 py-0.5 bg-[#2C3E56] rounded text-xs text-[#B8BFC6]">
          {sector}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-[#B8BFC6]">
          +{remaining}
        </span>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Investor>>({});
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (!data.authenticated) {
        router.push('/');
        return;
      }
      setAuthChecked(true);
      fetchInvestors();
    } catch {
      router.push('/');
    }
  };

  const fetchInvestors = async () => {
    try {
      const res = await fetch('/api/investors');
      const data = await res.json();
      setInvestors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch investors:', err);
      setInvestors([]);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Clear cached data? Will re-scrape on next screening.')) return;
    try {
      await fetch(`/api/investors?id=${id}&action=clear-cache`, { method: 'DELETE' });
      fetchInvestors();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  };

  const deleteInvestor = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this investor permanently?')) return;
    try {
      await fetch(`/api/investors?id=${id}`, { method: 'DELETE' });
      fetchInvestors();
    } catch (err) {
      console.error('Failed to delete investor:', err);
    }
  };

  const startEdit = (investor: Investor, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(investor.id);
    setEditingId(investor.id);
    setEditForm({
      name: investor.name,
      website: investor.website || '',
      hq: investor.hq || '',
      sectors: investor.sectors || '',
      check_size_min: investor.check_size_min,
      check_size_max: investor.check_size_max,
      stages: investor.stages || '',
      geo_focus: investor.geo_focus || '',
      geographic_restrictions: investor.geographic_restrictions || '',
      geographic_exceptions: investor.geographic_exceptions,
      is_actual_investor: investor.is_actual_investor,
      organization_type: investor.organization_type || '',
      portfolio_signals: investor.portfolio_signals || '',
      description: investor.description || '',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await fetch('/api/investors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      setEditingId(null);
      fetchInvestors();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const filteredInvestors = investors.filter(i => 
    i.name.toLowerCase().includes(filter.toLowerCase()) ||
    (i.sectors || '').toLowerCase().includes(filter.toLowerCase()) ||
    (i.organization_type || '').toLowerCase().includes(filter.toLowerCase())
  );

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-[#192432] flex items-center justify-center">
        <div className="text-[#FBFAF8]">{!authChecked ? 'Checking access...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#192432] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-medium text-[#FBFAF8]">Investor Database</h1>
            <p className="text-[#5A6A7A] text-sm mt-1">{investors.length} investors cached</p>
          </div>
          <a 
            href="/" 
            className="px-4 py-2 rounded-lg bg-[#2C3E56] text-[#B8BFC6] hover:text-[#FBFAF8] text-sm transition-colors"
          >
            ← Back to Screener
          </a>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search investors..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-[#1E2D3D] border border-[#2C3E56] text-[#FBFAF8] placeholder-[#5A6A7A] focus:outline-none focus:border-[#3D5A80] transition-colors"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-[#2C3E56] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1E2D3D]">
                <th className="text-left p-4 text-[#5A6A7A] text-xs font-medium uppercase tracking-wider">Investor</th>
                <th className="text-left p-4 text-[#5A6A7A] text-xs font-medium uppercase tracking-wider">Type</th>
                <th className="text-left p-4 text-[#5A6A7A] text-xs font-medium uppercase tracking-wider">Sectors</th>
                <th className="text-left p-4 text-[#5A6A7A] text-xs font-medium uppercase tracking-wider">Check Size</th>
                <th className="text-left p-4 text-[#5A6A7A] text-xs font-medium uppercase tracking-wider">Geography</th>
                <th className="text-right p-4 text-[#5A6A7A] text-xs font-medium uppercase tracking-wider">Cached</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestors.map((investor, idx) => (
                <Fragment key={investor.id}>
                  <tr 
                    className={`border-t border-[#2C3E56] hover:bg-[#1E2D3D] cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-[#192432]' : 'bg-[#1A2836]'}`}
                    onClick={() => setExpandedId(expandedId === investor.id ? null : investor.id)}
                  >
                    <td className="p-4">
                      <div className="font-medium text-[#FBFAF8]">{investor.name}</div>
                      {investor.website && (
                        <div className="text-[#5A6A7A] text-xs mt-0.5">{investor.website}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <TypeBadge type={investor.organization_type} isInvestor={investor.is_actual_investor} />
                    </td>
                    <td className="p-4">
                      <SectorPills sectors={investor.sectors} />
                    </td>
                    <td className="p-4 text-[#B8BFC6] text-sm whitespace-nowrap">
                      {investor.check_size_min || investor.check_size_max 
                        ? `${formatCheckSize(investor.check_size_min)} – ${formatCheckSize(investor.check_size_max)}`
                        : <span className="text-[#5A6A7A]">—</span>}
                    </td>
                    <td className="p-4 text-sm text-[#B8BFC6]">
                      {investor.geographic_restrictions 
                        ? capitalize(investor.geographic_restrictions)
                        : capitalize(investor.geo_focus || 'Global')}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-[#5A6A7A] text-xs">{formatDate(investor.last_enriched_at)}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => startEdit(investor, e)}
                            className="p-1.5 rounded hover:bg-[#2C3E56] text-[#5A6A7A] hover:text-[#FBFAF8] transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => clearCache(investor.id, e)}
                            className="p-1.5 rounded hover:bg-[#2C3E56] text-[#5A6A7A] hover:text-amber-400 transition-colors"
                            title="Re-scrape"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => deleteInvestor(investor.id, e)}
                            className="p-1.5 rounded hover:bg-[#2C3E56] text-[#5A6A7A] hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded Details */}
                  {expandedId === investor.id && (
                    <tr className="bg-[#1E2D3D] border-t border-[#2C3E56]">
                      <td colSpan={6} className="p-6">
                        {editingId === investor.id ? (
                          /* Edit Form */
                          <div className="space-y-4">
                            {/* Row 1: Name, Website, HQ, Type */}
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Name</label>
                                <input
                                  type="text"
                                  value={editForm.name || ''}
                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Website</label>
                                <input
                                  type="text"
                                  value={editForm.website || ''}
                                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                                  placeholder="www.example.com"
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">HQ</label>
                                <input
                                  type="text"
                                  value={editForm.hq || ''}
                                  onChange={(e) => setEditForm({ ...editForm, hq: e.target.value })}
                                  placeholder="Germany"
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Type</label>
                                <select
                                  value={editForm.organization_type || ''}
                                  onChange={(e) => setEditForm({ ...editForm, organization_type: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                >
                                  <option value="vc">VC</option>
                                  <option value="cvc">CVC</option>
                                  <option value="pe">PE (Private Equity)</option>
                                  <option value="angel">Angel</option>
                                  <option value="family-office">Family Office</option>
                                  <option value="accelerator">Accelerator</option>
                                  <option value="government">Government</option>
                                  <option value="non-profit">Non-profit</option>
                                </select>
                              </div>
                            </div>
                            
                            {/* Row 2: Sectors, Check Size */}
                            <div className="grid grid-cols-4 gap-4">
                              <div className="col-span-2">
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Sectors</label>
                                <input
                                  type="text"
                                  value={editForm.sectors || ''}
                                  onChange={(e) => setEditForm({ ...editForm, sectors: e.target.value })}
                                  placeholder="climate, agritech, robotics"
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Check Min (€)</label>
                                <input
                                  type="number"
                                  value={editForm.check_size_min || ''}
                                  onChange={(e) => setEditForm({ ...editForm, check_size_min: e.target.value ? Number(e.target.value) : null })}
                                  placeholder="500000"
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Check Max (€)</label>
                                <input
                                  type="number"
                                  value={editForm.check_size_max || ''}
                                  onChange={(e) => setEditForm({ ...editForm, check_size_max: e.target.value ? Number(e.target.value) : null })}
                                  placeholder="5000000"
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                            </div>
                            
                            {/* Row 3: Stages, Geo */}
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Stages</label>
                                <input
                                  type="text"
                                  value={editForm.stages || ''}
                                  onChange={(e) => setEditForm({ ...editForm, stages: e.target.value })}
                                  placeholder="Seed, Series A"
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Geo Focus</label>
                                <input
                                  type="text"
                                  value={editForm.geo_focus || ''}
                                  onChange={(e) => setEditForm({ ...editForm, geo_focus: e.target.value })}
                                  placeholder="europe, uk"
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Geo Restrictions</label>
                                <input
                                  type="text"
                                  value={editForm.geographic_restrictions || ''}
                                  onChange={(e) => setEditForm({ ...editForm, geographic_restrictions: e.target.value || null })}
                                  placeholder="None"
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Geo Exceptions</label>
                                <select
                                  value={editForm.geographic_exceptions || 0}
                                  onChange={(e) => setEditForm({ ...editForm, geographic_exceptions: Number(e.target.value) })}
                                  className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                                >
                                  <option value={0}>No</option>
                                  <option value={1}>Yes</option>
                                </select>
                              </div>
                            </div>
                            
                            {/* Row 4: Portfolio Signals */}
                            <div>
                              <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Portfolio Signals</label>
                              <input
                                type="text"
                                value={editForm.portfolio_signals || ''}
                                onChange={(e) => setEditForm({ ...editForm, portfolio_signals: e.target.value })}
                                placeholder="Notable portfolio companies"
                                className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80]"
                              />
                            </div>
                            
                            {/* Row 5: Description */}
                            <div>
                              <label className="block text-[#5A6A7A] text-xs mb-1.5 uppercase tracking-wider">Description</label>
                              <textarea
                                value={editForm.description || ''}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="Auto-generated when investor is scraped. You can edit here."
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg bg-[#192432] border border-[#2C3E56] text-[#FBFAF8] text-sm focus:outline-none focus:border-[#3D5A80] resize-none"
                              />
                            </div>
                            
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="px-4 py-2 bg-[#FBFAF8] hover:bg-white text-[#192432] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-4 py-2 bg-[#2C3E56] hover:bg-[#3D5A80] text-[#B8BFC6] rounded-lg text-sm transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View Details */
                          <div className="space-y-4">
                            {/* Description at top */}
                            {investor.description && (
                              <div className="pb-4 border-b border-[#2C3E56]">
                                <div className="text-[#5A6A7A] text-xs uppercase tracking-wider mb-2">Description</div>
                                <div className="text-[#FBFAF8] text-sm leading-relaxed">{investor.description}</div>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-4 gap-6">
                              <div>
                                <div className="text-[#5A6A7A] text-xs uppercase tracking-wider mb-1">Website</div>
                                <div className="text-[#FBFAF8] text-sm">
                                  {investor.website ? (
                                    <a href={`https://${investor.website}`} target="_blank" rel="noopener noreferrer" className="text-[#FBFAF8] hover:underline">
                                      {investor.website}
                                    </a>
                                  ) : '—'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[#5A6A7A] text-xs uppercase tracking-wider mb-1">HQ</div>
                                <div className="text-[#FBFAF8] text-sm">{investor.hq || '—'}</div>
                              </div>
                              <div>
                                <div className="text-[#5A6A7A] text-xs uppercase tracking-wider mb-1">Stages</div>
                                <div className="text-[#FBFAF8] text-sm">{investor.stages ? investor.stages.split(',').map(s => capitalize(s.trim())).join(', ') : '—'}</div>
                              </div>
                              <div>
                                <div className="text-[#5A6A7A] text-xs uppercase tracking-wider mb-1">Geo Exceptions</div>
                                <div className="text-[#FBFAF8] text-sm">{investor.geographic_exceptions ? 'Yes' : 'No'}</div>
                              </div>
                              <div className="col-span-2">
                                <div className="text-[#5A6A7A] text-xs uppercase tracking-wider mb-1">Sectors</div>
                                <div className="text-sm"><SectorPills sectors={investor.sectors} expanded={true} /></div>
                              </div>
                              <div className="col-span-2">
                                <div className="text-[#5A6A7A] text-xs uppercase tracking-wider mb-1">Portfolio Signals</div>
                                <div className="text-[#FBFAF8] text-sm">{investor.portfolio_signals || '—'}</div>
                              </div>
                              {investor.enrichment_flags && (
                                <div className="col-span-4">
                                  <div className="text-[#5A6A7A] text-xs uppercase tracking-wider mb-1">⚠️ Data Quality Flags</div>
                                  <div className="text-rose-300 text-sm">{investor.enrichment_flags}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          
          {filteredInvestors.length === 0 && (
            <div className="p-8 text-center text-[#5A6A7A]">
              No investors found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
