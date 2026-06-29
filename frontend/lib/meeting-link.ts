/**
 * Append `uname=<URL-encoded display name>` to a Zoom join URL so the
 * web client's "Your Name" field is pre-filled with the joiner's real
 * name. Used on intern surfaces (intern weekly meetings, intern
 * evaluations, intern interviews) so the intern shows up in the meeting
 * as themselves rather than as the shared host account ("Skyzen").
 *
 * Mirrors backend/.../integration/meeting/MeetingLinkUtil.java
 * (Java side handles email rendering; this handles in-app click
 * targets). Keep the two in sync.
 *
 * Reliability:
 *   - Web client: pre-fills reliably (and is the dominant path for
 *     interns on personal devices without the Zoom app installed).
 *   - Native Zoom client: the deep-link handler typically drops the
 *     param and uses the signed-in user's account name.
 *   - The pre-filled value is editable, not locked. Zoom's registrant
 *     flow is the locked-in alternative; not yet wired (see Java doc).
 */
export function appendDisplayName(
  joinUrl: string | null | undefined,
  displayName: string | null | undefined,
): string | null {
  if (!joinUrl) return null;
  if (!displayName || !displayName.trim()) return joinUrl;
  const encoded = encodeURIComponent(displayName.trim());
  // Strip URL fragment so the param lands before the # if present.
  const fragIdx = joinUrl.indexOf('#');
  const base = fragIdx >= 0 ? joinUrl.substring(0, fragIdx) : joinUrl;
  const frag = fragIdx >= 0 ? joinUrl.substring(fragIdx) : '';
  const sep = base.indexOf('?') >= 0 ? '&' : '?';
  return `${base}${sep}uname=${encoded}${frag}`;
}
