export const PRIVATE_PREVIEW_COOKIE = 'panachaiko_private_preview';
export const PRIVATE_PREVIEW_TTL_SECONDS = 60 * 60 * 8;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

export function privatePreviewSecret() {
  return (process.env.PRIVATE_PREVIEW_SECRET || import.meta.env.PRIVATE_PREVIEW_SECRET || '').trim();
}

export async function createPrivatePreviewCookie(secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + PRIVATE_PREVIEW_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload, secret)}`;
}

export async function isPrivatePreviewCookieValid(value: string | undefined, secret: string) {
  if (!value || !secret) return false;
  const [expiresAtValue, signature, ...extraParts] = value.split('.');
  const expiresAt = Number.parseInt(expiresAtValue || '', 10);
  if (extraParts.length || !expiresAtValue || !signature || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqual(signature, await sign(expiresAtValue, secret));
}

export async function isPrivatePreviewPasswordValid(candidate: string, secret: string) {
  if (!candidate || !secret) return false;
  return constantTimeEqual(await sign('private-preview-access', candidate), await sign('private-preview-access', secret));
}

export function safeInternalRedirect(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '/map';
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return '/map';
  return path;
}
