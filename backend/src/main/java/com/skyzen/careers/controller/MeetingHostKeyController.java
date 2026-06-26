package com.skyzen.careers.controller;

import com.skyzen.careers.integration.webex.WebexService;
import com.skyzen.careers.repository.InternEvaluationRepository;
import com.skyzen.careers.repository.InterviewRepository;
import com.skyzen.careers.repository.WeeklyMeetingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * On-demand fetch of a meeting's 6-digit Webex host key — the value the
 * scheduler enters inside Webex to claim host control on a meeting that
 * was scheduled under the service host ({@code techteam@skyzentech.com}).
 *
 * <p>The key is intentionally NOT denormalized onto the per-domain meeting
 * rows (weekly meetings / interviews / evaluations) because Webex rotates
 * it after each scheduled-end time — a stored value goes stale silently.
 * Every fetch hits {@code GET /v1/meetings/{id}?hostEmail=techteam@} so
 * the scheduler's modal always sees the live value.</p>
 *
 * <p>This endpoint is staff-only (no INTERN access). To avoid acting as a
 * generic host-key proxy for arbitrary Webex meeting IDs we verify the
 * supplied provider id exists in at least one of our three meeting
 * tables ({@code weekly_meetings}, {@code interviews},
 * {@code intern_evaluations}) before forwarding to Webex. 404s otherwise.</p>
 *
 * <p>Returns a small shape: {@code { providerMeetingId, hostKey, fetchedAt,
 * available }}. {@code available=false} when the key was null (JBH not on,
 * or host-email mismatch) — the frontend uses that to render the
 * "sign in to webex.com as techteam@" fallback guidance.</p>
 */
@RestController
@RequestMapping("/api/v1/meetings")
@RequiredArgsConstructor
public class MeetingHostKeyController {

    private final WebexService webexService;
    private final WeeklyMeetingRepository weeklyMeetingRepository;
    private final InterviewRepository interviewRepository;
    private final InternEvaluationRepository internEvaluationRepository;

    @GetMapping("/{providerMeetingId}/host-key")
    @PreAuthorize("hasAnyRole('TRAINER', 'REPORTING_MANAGER', 'MANAGER', 'ERM', 'SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> hostKey(@PathVariable String providerMeetingId) {
        boolean known = weeklyMeetingRepository.findFirstByZoomMeetingId(providerMeetingId).isPresent()
                || interviewRepository.findFirstByZoomMeetingId(providerMeetingId).isPresent()
                || internEvaluationRepository.findFirstByZoomMeetingId(providerMeetingId).isPresent();
        if (!known) {
            return ResponseEntity.notFound().build();
        }
        String hostKey = webexService.fetchHostKey(providerMeetingId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("providerMeetingId", providerMeetingId);
        body.put("hostKey", hostKey);
        body.put("available", hostKey != null);
        body.put("fetchedAt", Instant.now().toString());
        // Host key rotates after each scheduled-end — never let intermediaries
        // (CDNs, browsers, Next.js fetch cache) reuse the value.
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(body);
    }
}
