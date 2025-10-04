// Stable, anonymous session id for impression attribution when user isn't signed-in.
export function getOrCreateSessionId(): string {
  const KEY = 'yp_session_id';
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    // 24 random bytes -> 32 char base64-ish; keep under 64 (your constraint)
    sid = crypto.getRandomValues(new Uint8Array(24)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

