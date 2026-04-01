const MAX_PREVIEW_LEN = 4000;

export function redactForIssue(text: string): string {
  if (!text) {
    return '';
  }
  let out = text;
  out = out.replace(/\bauthorization\s*:\s*[^\s]+/gi, 'authorization: [REDACTED]');
  out = out.replace(/\bcookie\s*:\s*[^\n]+/gi, 'cookie: [REDACTED]');
  out = out.replace(/\bset-cookie\s*:\s*[^\n]+/gi, 'set-cookie: [REDACTED]');
  out = out.replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]');
  out = out.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[REDACTED]',
  );
  if (out.length > MAX_PREVIEW_LEN) {
    return `${out.slice(0, MAX_PREVIEW_LEN)}\n…`;
  }
  return out;
}

export function truncatePreview(text: string, max = MAX_PREVIEW_LEN): string {
  if (!text || text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n…`;
}
