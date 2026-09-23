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
  const turnstileToken = clean(payload['cf-turnstile-response'] ?? payload.turnstileToken, 2048);

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

  if (!turnstileToken) {
    return json({ message: 'Ολοκληρώστε την επαλήθευση ασφαλείας Cloudflare.' }, 400);
  }

  const wordpressEndpoint =
    import.meta.env.CONTACT_WORDPRESS_ENDPOINT ||
    'https://cms.panachaikotrails.gr/wp-json/panachaiko/v1/contact/';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const body = JSON.stringify({
      name,
      email,
      phone,
      message,
      website,
      consent: 'yes',
      startedAt,
      turnstileToken,
    });

    const sendPost = async (target: string) => {
      let response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'PanachaikoTrails-Contact/1.0',
        },
        body,
        signal: controller.signal,
        redirect: 'manual',
      });

      // Some hosting/canonical rules answer with 301/302. Re-POST to the target
      // instead of letting fetch silently convert the request to GET.
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          const redirected = new URL(location, target).toString();
          response = await fetch(redirected, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'PanachaikoTrails-Contact/1.0',
            },
            body,
            signal: controller.signal,
            redirect: 'manual',
          });
        }
      }
      return response;
    };

    let response = await sendPost(wordpressEndpoint);
    let result = await response.json().catch(() => ({}));

    // Retry the alternate trailing-slash form when WordPress reports no matching route.
    if (!response.ok && result?.code === 'rest_no_route') {
      const alternate = wordpressEndpoint.endsWith('/')
        ? wordpressEndpoint.slice(0, -1)
        : wordpressEndpoint + '/';
      response = await sendPost(alternate);
      result = await response.json().catch(() => ({}));
    }

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('WordPress contact endpoint error', response.status, result);

      if (result?.code === 'rest_no_route') {
        return json(
          { message: 'Το WordPress endpoint επικοινωνίας δεν είναι ενεργό. Ελέγξτε ότι το Panachaiko Trails Admin UI 0.9.9 είναι εγκατεστημένο και ενεργό.' },
          503,
        );
      }

      return json(
        { message: typeof result?.message === 'string' ? result.message : 'Η αποστολή δεν ολοκληρώθηκε. Δοκιμάστε ξανά σε λίγο.' },
        response.status >= 400 && response.status < 600 ? response.status : 502,
      );
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Contact proxy error', error);
    return json({ message: 'Δεν ήταν δυνατή η σύνδεση με την υπηρεσία email. Δοκιμάστε ξανά.' }, 502);
  }
};
