package com.skyzen.careers.intern;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WeeklyMeeting;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.integration.zoom.ZoomMeetingRequest;
import com.skyzen.careers.integration.zoom.ZoomMeetingResponse;
import com.skyzen.careers.integration.zoom.ZoomService;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.repository.WeeklyMeetingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Phase 5 weekly trainer-intern meeting orchestration. Reuses the existing
 * {@link ZoomService} for actual meeting create/update/delete. Trainer scope
 * enforced via {@code intern_lifecycles.trainer_id}; SUPER_ADMIN bypasses.
 *
 * <p>Recurrence: when {@code recurrence=WEEKLY} the first occurrence triggers
 * a Zoom create, and the next 11 child rows are persisted upfront sharing
 * the same {@code zoom_meeting_id} so the intern UI can list all 12 weeks
 * without a Zoom round-trip per row.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WeeklyMeetingService {

    private static final int WEEKLY_OCCURRENCES = 12;

    private final WeeklyMeetingRepository meetingRepository;
    private final InternLifecycleRepository lifecycleRepository;
    private final UserRepository userRepository;
    private final ZoomService zoomService;

    // ── Trainer commands ────────────────────────────────────────────────────

    @Transactional
    public WeeklyMeeting schedule(UUID internLifecycleId,
                                   Instant scheduledFor,
                                   Integer durationMinutes,
                                   String timezone,
                                   String topic,
                                   String agenda,
                                   String recurrence,
                                   User actor) {
        if (scheduledFor == null || scheduledFor.isBefore(Instant.now().minus(Duration.ofMinutes(5)))) {
            throw new BadRequestException("scheduledFor must be in the future");
        }
        if (topic == null || topic.isBlank()) {
            throw new BadRequestException("topic is required");
        }
        InternLifecycle lc = lifecycleRepository.findById(internLifecycleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle not found: " + internLifecycleId));
        ensureTrainerScope(lc, actor);
        ensureActiveIntern(lc);

        int duration = durationMinutes == null ? 30 : Math.max(15, Math.min(180, durationMinutes));
        String tz = (timezone == null || timezone.isBlank()) ? "UTC" : timezone;

        // Create the Zoom meeting (best-effort).
        Long zoomId = null;
        String joinUrl = null;
        String startUrl = null;
        String password = null;
        if (zoomService.isReady()) {
            try {
                String hostId = actor.getZoomEmail() != null && !actor.getZoomEmail().isBlank()
                        ? actor.getZoomEmail() : "me";
                ZoomMeetingResponse z = zoomService.createMeeting(
                        new ZoomMeetingRequest(hostId, topic, scheduledFor, duration, tz, agenda));
                zoomId = z.meetingId();
                joinUrl = z.joinUrl();
                startUrl = z.startUrl();
                password = z.password();
                log.info("[WeeklyMeeting] Zoom meeting created id={} for lifecycle={}",
                        zoomId, lc.getId());
            } catch (Exception e) {
                log.warn("[WeeklyMeeting] Zoom create failed (non-fatal): {}", e.getMessage());
            }
        }

        WeeklyMeeting first = WeeklyMeeting.builder()
                .internLifecycleId(lc.getId())
                .scheduledFor(scheduledFor)
                .durationMinutes(duration)
                .timezone(tz)
                .topic(topic)
                .agenda(agenda)
                .zoomMeetingId(zoomId)
                .zoomJoinUrl(joinUrl)
                .zoomStartUrl(startUrl)
                .zoomPassword(password)
                .hostUserId(actor.getId())
                .status("SCHEDULED")
                .recurrence("WEEKLY".equalsIgnoreCase(recurrence) ? "WEEKLY" : null)
                .build();
        first = meetingRepository.save(first);

        // Project child occurrences for a recurring series so the intern's UI
        // can show 12 weeks without per-week Zoom calls. Children share the
        // same Zoom meeting id (recurring meeting on the Zoom side).
        if ("WEEKLY".equalsIgnoreCase(recurrence)) {
            for (int i = 1; i < WEEKLY_OCCURRENCES; i++) {
                WeeklyMeeting child = WeeklyMeeting.builder()
                        .internLifecycleId(lc.getId())
                        .scheduledFor(scheduledFor.plus(Duration.ofDays(7L * i)))
                        .durationMinutes(duration)
                        .timezone(tz)
                        .topic(topic)
                        .agenda(agenda)
                        .zoomMeetingId(zoomId)
                        .zoomJoinUrl(joinUrl)
                        .zoomStartUrl(startUrl)
                        .zoomPassword(password)
                        .hostUserId(actor.getId())
                        .status("SCHEDULED")
                        .recurrence(null)
                        .recurrenceParentId(first.getId())
                        .build();
                meetingRepository.save(child);
            }
        }
        return first;
    }

    @Transactional
    public WeeklyMeeting reschedule(UUID meetingId,
                                     Instant newScheduledFor,
                                     Integer newDurationMinutes,
                                     User actor) {
        WeeklyMeeting m = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Meeting not found: " + meetingId));
        ensureHostOrSuperAdmin(m, actor);
        if (!"SCHEDULED".equals(m.getStatus())) {
            throw new ConflictException(
                    "Only SCHEDULED meetings can be rescheduled (current: " + m.getStatus() + ")");
        }
        if (newScheduledFor == null || newScheduledFor.isBefore(Instant.now())) {
            throw new BadRequestException("scheduledFor must be in the future");
        }
        if (newDurationMinutes != null) {
            m.setDurationMinutes(Math.max(15, Math.min(180, newDurationMinutes)));
        }
        m.setScheduledFor(newScheduledFor);
        if (m.getZoomMeetingId() != null && zoomService.isReady()) {
            try {
                zoomService.updateMeeting(m.getZoomMeetingId(),
                        new ZoomMeetingRequest(null, m.getTopic(), m.getScheduledFor(),
                                m.getDurationMinutes(), m.getTimezone(), m.getAgenda()));
            } catch (Exception e) {
                log.warn("[WeeklyMeeting] Zoom update failed (non-fatal) for {}: {}",
                        m.getId(), e.getMessage());
            }
        }
        return meetingRepository.save(m);
    }

    @Transactional
    public WeeklyMeeting complete(UUID meetingId, String trainerNotes, User actor) {
        WeeklyMeeting m = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Meeting not found: " + meetingId));
        ensureHostOrSuperAdmin(m, actor);
        if ("COMPLETED".equals(m.getStatus())) return m;
        // Trainer Phase 3 — guard against marking a future meeting complete by
        // mistake. 15-minute leeway tolerates clock skew + early-start
        // sessions but blocks "complete a meeting 3 days from now".
        if (m.getScheduledFor() != null
                && m.getScheduledFor().isAfter(Instant.now().plus(Duration.ofMinutes(15)))) {
            throw new ConflictException(
                    "Cannot mark a future meeting (scheduled "
                            + m.getScheduledFor() + ") as completed");
        }
        m.setStatus("COMPLETED");
        if (trainerNotes != null && !trainerNotes.isBlank()) {
            m.setTrainerNotes(trainerNotes.trim());
        }
        return meetingRepository.save(m);
    }

    /** Trainer Phase 3 — manual mark-missed by the host trainer when the
     *  intern was a no-show. The {@code MissedMeetingDetectorJob} fires the
     *  same path automatically when a SCHEDULED meeting elapses past its
     *  4-hour grace window. */
    @Transactional
    public WeeklyMeeting markMissed(UUID meetingId, String missedBy,
                                     String reason, User actor) {
        WeeklyMeeting m = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Meeting not found: " + meetingId));
        ensureHostOrSuperAdmin(m, actor);
        if (!"SCHEDULED".equals(m.getStatus())) {
            throw new ConflictException(
                    "Only SCHEDULED meetings can be marked missed (current: "
                            + m.getStatus() + ")");
        }
        m.setStatus("NO_SHOW");
        StringBuilder note = new StringBuilder();
        if (m.getTrainerNotes() != null && !m.getTrainerNotes().isBlank()) {
            note.append(m.getTrainerNotes()).append("\n\n");
        }
        note.append("Marked NO_SHOW");
        if (missedBy != null && !missedBy.isBlank()) {
            note.append(" — missed by ").append(missedBy.trim());
        }
        if (reason != null && !reason.isBlank()) {
            note.append(": ").append(reason.trim());
        }
        m.setTrainerNotes(note.toString());
        return meetingRepository.save(m);
    }

    /** Internal helper used by the {@code MissedMeetingDetectorJob} so the
     *  auto-flip path doesn't trip the host-or-super-admin guard. */
    @Transactional
    public WeeklyMeeting markMissedSystem(UUID meetingId, String reason) {
        WeeklyMeeting m = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Meeting not found: " + meetingId));
        if (!"SCHEDULED".equals(m.getStatus())) return m;
        m.setStatus("NO_SHOW");
        String prev = m.getTrainerNotes() != null && !m.getTrainerNotes().isBlank()
                ? m.getTrainerNotes() + "\n\n" : "";
        m.setTrainerNotes(prev + "Auto-detected NO_SHOW: " + reason);
        return meetingRepository.save(m);
    }

    @Transactional
    public WeeklyMeeting cancel(UUID meetingId, User actor) {
        WeeklyMeeting m = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Meeting not found: " + meetingId));
        ensureHostOrSuperAdmin(m, actor);
        if (!"SCHEDULED".equals(m.getStatus())) {
            throw new ConflictException("Only SCHEDULED meetings can be cancelled");
        }
        // Only delete the Zoom meeting when cancelling the FIRST occurrence of
        // a series; child occurrences share the same Zoom id and shouldn't
        // tear down the whole recurring meeting.
        boolean isSeriesParent = "WEEKLY".equals(m.getRecurrence());
        boolean isStandalone = m.getRecurrenceParentId() == null && m.getRecurrence() == null;
        if (m.getZoomMeetingId() != null && (isSeriesParent || isStandalone)
                && zoomService.isReady()) {
            try {
                zoomService.deleteMeeting(m.getZoomMeetingId());
            } catch (Exception e) {
                log.warn("[WeeklyMeeting] Zoom delete failed (non-fatal) for {}: {}",
                        m.getId(), e.getMessage());
            }
        }
        m.setStatus("CANCELLED");
        return meetingRepository.save(m);
    }

    // ── Reads ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<WeeklyMeeting> listForLifecycle(UUID internLifecycleId) {
        return meetingRepository.findByInternLifecycleIdOrderByScheduledForAsc(internLifecycleId);
    }

    @Transactional(readOnly = true)
    public List<WeeklyMeeting> listForUserCaller(User caller) {
        // INTERN view: scope by their own InternLifecycle.user_id.
        InternLifecycle lc = lifecycleRepository.findByUserId(caller.getId()).orElse(null);
        if (lc == null) return List.of();
        return meetingRepository.findByInternLifecycleIdOrderByScheduledForAsc(lc.getId());
    }

    @Transactional(readOnly = true)
    public WeeklyMeeting requireForReader(UUID meetingId, User caller) {
        WeeklyMeeting m = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Meeting not found: " + meetingId));
        boolean staff = caller.getRoles().contains(UserRole.TRAINER)
                || caller.getRoles().contains(UserRole.REPORTING_MANAGER)
                || caller.getRoles().contains(UserRole.MANAGER)
                || caller.getRoles().contains(UserRole.ERM)
                || caller.getRoles().contains(UserRole.SUPER_ADMIN);
        if (staff) return m;
        // INTERN: must own the lifecycle.
        InternLifecycle lc = lifecycleRepository.findByUserId(caller.getId()).orElse(null);
        if (lc == null || !lc.getId().equals(m.getInternLifecycleId())) {
            throw new ForbiddenException("Not allowed to view this meeting");
        }
        return m;
    }

    // ── Internals ──────────────────────────────────────────────────────────

    private void ensureTrainerScope(InternLifecycle lc, User actor) {
        if (actor.getRoles().contains(UserRole.SUPER_ADMIN)) return;
        if (lc.getTrainerId() != null && lc.getTrainerId().equals(actor.getId())) return;
        throw new ForbiddenException(
                "Caller is not the assigned trainer for this lifecycle");
    }

    private void ensureHostOrSuperAdmin(WeeklyMeeting m, User actor) {
        if (actor.getRoles().contains(UserRole.SUPER_ADMIN)) return;
        if (m.getHostUserId() != null && m.getHostUserId().equals(actor.getId())) return;
        throw new ForbiddenException("Caller is not the host trainer for this meeting");
    }

    private void ensureActiveIntern(InternLifecycle lc) {
        // Trainer Phase 3 — accept both ACTIVE and PROSPECTIVE so demo /
        // pre-start interns can still have prep meetings scheduled.
        String s = lc.getActiveStatus();
        if (!"ACTIVE".equals(s) && !"PROSPECTIVE".equals(s)) {
            throw new ConflictException(
                    "Lifecycle is not schedulable (current: " + s + ")");
        }
    }

    /** Trainer Phase 3 — meetings hosted by the caller. SUPER_ADMIN gets
     *  everything; TRAINER sees just their own. */
    @Transactional(readOnly = true)
    public List<WeeklyMeeting> listForTrainer(User caller) {
        if (caller == null) return List.of();
        if (caller.getRoles().contains(UserRole.SUPER_ADMIN)) {
            return meetingRepository.findAll();
        }
        return meetingRepository.findByHostUserIdOrderByScheduledForDesc(caller.getId());
    }
}
