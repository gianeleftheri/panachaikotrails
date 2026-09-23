import type { APIRoute } from 'astro';
import { PRIVATE_PREVIEW_COOKIE, PRIVATE_PREVIEW_TTL_SECONDS, createPrivatePreviewCookie, isPrivatePreviewPasswordValid, privatePreviewSecret, safeInternalRedirect } from '../../lib/private-preview';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const data = await request.formData();
  const password = String(data.get('password') || '');
  const redirectTo = safeInternalRedirect(data.get('redirect'));
  const secret = privatePreviewSecret();
  if (!secret) return redirect('/preview?error=config', 303);
  if (!(await isPrivatePreviewPasswordValid(password, secret))) return redirect('/preview?error=invalid', 303);

  cookies.set(PRIVATE_PREVIEW_COOKIE, await createPrivatePreviewCookie(secret), {
    httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict', path: '/', maxAge: PRIVATE_PREVIEW_TTL_SECONDS
  });
  return redirect(redirectTo, 303);
};
