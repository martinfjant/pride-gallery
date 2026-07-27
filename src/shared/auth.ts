import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { timingSafeEqual } from 'node:crypto';

export function checkUploadAuth(request: HttpRequest): HttpResponseInit | null {
  const expected = process.env.UPLOAD_PASSWORD;
  if (!expected) {
    return { status: 500, jsonBody: { error: 'servern är felkonfigurerad: UPLOAD_PASSWORD är inte satt' } };
  }

  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1];
  if (!provided) {
    return {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
      jsonBody: { error: 'bearer-token saknas' },
    };
  }

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
      jsonBody: { error: 'ogiltig token' },
    };
  }

  return null;
}
