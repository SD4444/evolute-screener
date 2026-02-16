import { NextRequest, NextResponse } from 'next/server';
import { getScreeningResults } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientName = searchParams.get('client');
    const format = searchParams.get('format') || 'csv';
    
    const results = getScreeningResults(clientName || undefined);
    
    if (format === 'json') {
      return NextResponse.json(results);
    }
    
    // CSV format
    const headers = ['Investor Name', 'Website', 'HQ', 'Verdict', 'Relevance Score', 'Reasoning', 'Industry Focus', 'Client', 'Screened At'];
    const rows = results.map(r => [
      r.investor_name || '',
      r.investor_website || '',
      r.investor_hq || '',
      r.verdict || '',
      r.relevance_score?.toString() || '',
      `"${(r.reasoning || '').replace(/"/g, '""')}"`,
      r.industry_focus || '',
      r.client_name || '',
      r.screened_at || '',
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="screening-results${clientName ? '-' + clientName : ''}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting results:', error);
    return NextResponse.json({ error: 'Failed to export results' }, { status: 500 });
  }
}
