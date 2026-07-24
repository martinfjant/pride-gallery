import { HttpRequest } from '@azure/functions';

/**
 * Reads a request body as a plain object, accepting either JSON or
 * form-encoded input. htmx posts `application/x-www-form-urlencoded`; the
 * JSON path stays for programmatic callers (e.g. scripts/upload-test.mjs).
 * Throws on malformed JSON — callers should wrap and return a 400.
 */
export async function readBody(request: HttpRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const out: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) out[key] = value;
    return out;
  }
  return (await request.json()) as Record<string, unknown>;
}

/** True when the request was issued by htmx (so we return an HTML fragment). */
export function isHtmx(request: HttpRequest): boolean {
  return request.headers.get('HX-Request') === 'true';
}
