import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { timingSafeEqual } from 'node:crypto';

export function checkUploadAuth(request: HttpRequest): HttpResponseInit | null {
  const expected = process.env.UPLOAD_PASSWORD;
  if (!expected) {
    return { status: 500, jsonBody: { error: 'server misconfigured: UPLOAD_PASSWORD not set' } };
  }

  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1];
  if (!provided) {
    return {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
      jsonBody: { error: 'missing bearer token' },
    };
  }

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
      jsonBody: { error: 'invalid token' },
    };
  }

  return null;
}
