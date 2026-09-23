import type { APIRoute } from 'astro';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] || char));

export const POST: APIRoute = async ({ request, url }) => {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== url.host) {
        return json({ message: 'Μη έγκυρη προέλευση αιτήματος.' }, 403);
      }
    } catch {
      return json({ message: 'Μη έγκυρη προέλευση αιτήματος.' }, 403);
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ message: 'Μη έγκυρα δεδομένα φόρμας.' }, 400);
  }

  const name = clean(payload.name, 100);
  const email = clean(payload.email, 160).toLowerCase();
  const phone = clean(payload.phone, 40);
  const message = clean(payload.message, 2000);
  const website = clean(payload.website, 200);
  const consent = payload.consent === 'yes';
  const startedAt = Number(payload.startedAt || 0);

  // Honeypot: pretend success so automated submitters get no useful signal.
  if (website) return json({ ok: true });

  if (!startedAt || Date.now() - startedAt < 1500) {
    return json({ message: 'Η φόρμα υποβλήθηκε πολύ γρήγορα. Δοκιμάστε ξανά.' }, 400);
  }

  if (!name || name.length < 2) {
    return json({ message: 'Συμπληρώστε το όνομά σας.' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ message: 'Συμπληρώστε έγκυρη διεύθυνση email.' }, 400);
  }

  if (!message || message.length < 10) {
    return json({ message: 'Το μήνυμα πρέπει να έχει τουλάχιστον 10 χαρακτήρες.' }, 400);
  }

  if (!consent) {
    return json({ message: 'Απαιτείται συγκατάθεση για την αποστολή της φόρμας.' }, 400);
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.CONTACT_TO_EMAIL || 'info@panachaikotrails.gr';
  const from = import.meta.env.CONTACT_FROM_EMAIL || 'Panachaiko Trails <onboarding@resend.dev>';

  if (!apiKey) {
    return json(
      { message: 'Η φόρμα είναι έτοιμη, αλλά δεν έχει ενεργοποιηθεί ακόμη η υπηρεσία αποστολής email.' },
      503,
    );
  }

  const subject = `Νέο μήνυμα από Panachaiko Trails — ${name}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17212b">
      <h2 style="margin:0 0 20px">Νέο μήνυμα από τη φόρμα επικοινωνίας</h2>
      <p><strong>Όνομα:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Τηλέφωνο:</strong> ${phone ? escapeHtml(phone) : '—'}</p>
      <p><strong>Μήνυμα:</strong></p>
      <div style="white-space:pre-wrap;padding:16px;background:#f5f7f9;border-radius:8px">${escapeHtml(message)}</div>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      console.error('Contact email provider error', response.status, await response.text());
      return json({ message: 'Η αποστολή δεν ολοκληρώθηκε. Δοκιμάστε ξανά σε λίγο.' }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Contact form error', error);
    return json({ message: 'Παρουσιάστηκε προσωρινό πρόβλημα αποστολής. Δοκιμάστε ξανά.' }, 500);
  }
};
