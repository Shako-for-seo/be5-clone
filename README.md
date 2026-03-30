const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmailAlert({ to, subject, html }) {
  if (!process.env.SMTP_USER) {
    console.warn('⚠️ SMTP not configured — skipping email');
    return false;
  }
  try {
    await getTransporter().sendMail({
      from: `"Be5 System" <${process.env.SMTP_USER}>`,
      to: to || process.env.ADMIN_EMAIL,
      subject,
      html,
    });
    console.log(`📧 Email sent: ${subject}`);
    return true;
  } catch (err) {
    console.error('❌ Email error:', err.message);
    return false;
  }
}

async function notifyNewLead(lead) {
  return sendEmailAlert({
    to: process.env.ADMIN_EMAIL,
    subject: `🎯 ახალი ლიდი: ${lead.name} — ${lead.company || 'კომპანია უცნობი'}`,
    html: `
      <h2>🎯 ახალი ლიდი!</h2>
      <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">სახელი</td><td style="padding:8px;">${lead.name}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">ტელეფონი</td><td style="padding:8px;">${lead.phone}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">ელ-ფოსტა</td><td style="padding:8px;">${lead.email || '—'}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">კომპანია</td><td style="padding:8px;">${lead.company || '—'}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">UTM Source</td><td style="padding:8px;">${lead.utm_source || '—'}</td></tr>
      </table>
      <p style="margin-top:16px;"><a href="${process.env.FRONTEND_URL}/admin/" style="background:#1a73e8;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">ადმინ პანელი</a></p>
    `,
  });
}

async function notifyNegativeSurvey({ phone, customerName, rating, response }) {
  const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  return sendEmailAlert({
    to: process.env.ADMIN_EMAIL,
    subject: `🚨 ნეგატიური შეფასება! ${stars} — ${phone}`,
    html: `
      <h2 style="color:#ef4444;">🚨 ნეგატიური შეფასება!</h2>
      <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">ტელეფონი</td><td style="padding:8px;">${phone}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">სახელი</td><td style="padding:8px;">${customerName || '—'}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">შეფასება</td><td style="padding:8px;">${stars} (${rating}/5)</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">კომენტარი</td><td style="padding:8px;">${response}</td></tr>
      </table>
      <p style="margin-top:16px;color:#ef4444;font-weight:bold;">⚡ სასწრაფოდ დაუკავშირდით მომხმარებელს!</p>
    `,
  });
}

module.exports = { sendEmailAlert, notifyNewLead, notifyNegativeSurvey };
