import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Only initialize if API key exists
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    const { to, clientName, qualified, disqualified, needsReview, total } = await request.json();
    
    if (!to || !clientName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!resend) {
      console.log('Email would be sent to:', to);
      console.log('Subject: Your investor screening for', clientName, 'is complete');
      return NextResponse.json({ sent: false, reason: 'No API key configured' });
    }

    const { data, error } = await resend.emails.send({
      from: 'Evolute Screener <onboarding@resend.dev>',
      to: [to],
      subject: `Your investor screening for ${clientName} is complete`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <img src="https://evolute.app/logo.png" alt="Evolute" style="height: 32px; margin-bottom: 32px;" />
          
          <h1 style="color: #192432; font-size: 24px; margin-bottom: 16px;">
            Screening Complete! 🎉
          </h1>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
            Your investor screening for <strong>${clientName}</strong> has finished.
          </p>
          
          <div style="background: #f7fafc; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <h2 style="color: #192432; font-size: 18px; margin: 0 0 16px 0;">Results Summary</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #4a5568;">Total Screened</td>
                <td style="padding: 8px 0; color: #192432; font-weight: 600; text-align: right;">${total}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #10b981;">✓ Qualified</td>
                <td style="padding: 8px 0; color: #10b981; font-weight: 600; text-align: right;">${qualified}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #ef4444;">✗ Disqualified</td>
                <td style="padding: 8px 0; color: #ef4444; font-weight: 600; text-align: right;">${disqualified}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #f59e0b;">⚠ Needs Review</td>
                <td style="padding: 8px 0; color: #f59e0b; font-weight: 600; text-align: right;">${needsReview}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
            Log back into the screener to view the full results and export them.
          </p>
          
          <p style="color: #9ca3af; font-size: 14px; margin-top: 32px;">
            — The Evolute Team
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Email error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sent: true, id: data?.id });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
