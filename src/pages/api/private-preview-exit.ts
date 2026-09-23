import type { APIRoute } from 'astro';
import { PRIVATE_PREVIEW_COOKIE } from '../../lib/private-preview';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(PRIVATE_PREVIEW_COOKIE, { path: '/' });
  return redirect('/preview', 303);
};
