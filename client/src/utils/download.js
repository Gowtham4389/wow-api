/** Trigger a browser download for in-memory text. */
export function downloadText(filename, text, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copy text, falling back to a hidden textarea where the async API is blocked. */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Suggest a filename from the request URL. */
export function suggestFilename(url, extension) {
  let base = 'response';
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    base = segments[segments.length - 1] || parsed.hostname.replace(/\./g, '-');
  } catch {
    /* keep the default */
  }
  const safe = base.replace(/[^a-z0-9._-]/gi, '-').slice(0, 60) || 'response';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${safe}-${stamp}.${extension}`;
}
