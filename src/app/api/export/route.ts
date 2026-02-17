import { NextRequest, NextResponse } from 'next/server';

// Stateless: export receives results from the client
export async function POST(request: NextRequest) {
  try {
    const { results, clientName, format } = await request.json();

    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ error: 'Results array required' }, { status: 400 });
    }

    if (format === 'json') {
      return NextResponse.json(results);
    }

    // CSV format
    const headers = ['Investor Name', 'Website', 'HQ', 'Verdict', 'Relevance Score', 'Reasoning', 'Industry Focus'];
    const rows = results.map((r: any) => [
      r.investor_name || '',
      r.website || '',
      r.hq || '',
      r.verdict || '',
      r.relevance_score?.toString() || '',
      `"${(r.reasoning || '').replace(/"/g, '""')}"`,
      r.industry_focus || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="screening-results${clientName ? '-' + clientName : ''}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}
