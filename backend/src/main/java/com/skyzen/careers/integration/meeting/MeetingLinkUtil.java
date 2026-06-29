package com.skyzen.careers.integration.meeting;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Utility for turning a generic provider join URL into a per-recipient
 * URL that pre-fills the joiner's display name. Used so participants
 * land in the Zoom (or future-provider) meeting with their actual name
 * instead of "Skyzen" (the host account name).
 *
 * <h2>Mechanism — Zoom's <code>uname</code> query parameter</h2>
 * Zoom's web client landing page reads <code>?uname=&lt;encoded name&gt;</code>
 * (or <code>&amp;uname=...</code> when other params already exist) and
 * pre-fills the "Your Name" field with that value. The user can still
 * edit the name before clicking Join — it's pre-filled, not locked.
 *
 * <h2>Reliability notes</h2>
 * <ul>
 *   <li><b>Web client</b>: pre-fill works reliably. Most ad-hoc joiners
 *       on personal devices land here.</li>
 *   <li><b>Native Zoom client</b>: when the user has Zoom installed and
 *       clicks "Open Zoom Meetings" on the landing page, Zoom's
 *       deep-link handler typically drops the {@code uname} param and
 *       uses the signed-in user's account name. Acceptable — the
 *       common case for our interns (often joining from personal
 *       laptops without Zoom installed) is the web client.</li>
 *   <li><b>Locked-in alternative</b>: Zoom's registrant flow
 *       ({@code POST /v2/meetings/{id}/registrants}) returns a per-
 *       registrant join URL whose name field is locked to the
 *       registered identity. Requires {@code settings.registration_type
 *       = 1} on create + a per-participant API call + storage of the
 *       returned per-registrant URLs. Significantly more invasive;
 *       deferred until the {@code uname} pre-fill proves insufficient.</li>
 * </ul>
 *
 * <p>This helper is a pure function — no Zoom/provider coupling beyond
 * the {@code uname} param name. Safe to call on any URL; if the input
 * is null/blank or the name is null/blank, returns the URL unchanged.</p>
 */
public final class MeetingLinkUtil {

    private MeetingLinkUtil() {}

    /**
     * Append a {@code uname=<name>} query param to a meeting join URL.
     *
     * @param joinUrl  the provider-issued join URL. May be null/blank;
     *                 returned unchanged in that case.
     * @param displayName  the participant's full name. May be null/blank;
     *                     the URL is returned unchanged when missing.
     * @return the join URL with the name appended, or the original URL
     *         when either input is missing.
     */
    public static String appendDisplayName(String joinUrl, String displayName) {
        if (joinUrl == null || joinUrl.isBlank()) return joinUrl;
        if (displayName == null || displayName.isBlank()) return joinUrl;
        String encoded = URLEncoder.encode(displayName.trim(), StandardCharsets.UTF_8);
        // URLEncoder uses '+' for spaces — fine for Zoom's web client.
        // Strip any URL fragment first so the param lands before the #.
        int fragIdx = joinUrl.indexOf('#');
        String base = fragIdx >= 0 ? joinUrl.substring(0, fragIdx) : joinUrl;
        String frag = fragIdx >= 0 ? joinUrl.substring(fragIdx) : "";
        String sep = base.indexOf('?') >= 0 ? "&" : "?";
        return base + sep + "uname=" + encoded + frag;
    }
}
