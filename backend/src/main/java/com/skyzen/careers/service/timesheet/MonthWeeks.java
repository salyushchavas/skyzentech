package com.skyzen.careers.service.timesheet;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Single source of truth for the "Mon–Fri work-weeks within a month"
 * model used by the intern timesheet entry grid + the Phase A roster.
 * A work-week is Monday-anchored; a week counts as part of a month if
 * <em>any</em> of its Mon–Fri days falls in the month. Edge weeks at
 * month boundaries expose only the weekdays that fall in the requested
 * month (so neither double-counted nor missed).
 *
 * <p>Pure functions; no Spring stereotype. Mirrors the convention of
 * other lightweight helpers under {@code service.timesheet}.</p>
 */
public final class MonthWeeks {

    private MonthWeeks() {}

    /** A single Mon–Fri work-week's view of a particular month. */
    public record WorkWeek(
            /** Monday this week begins on (may be in the prior month). */
            LocalDate weekStart,
            /** Position within the month, 1-based — primarily for labels. */
            int weekNumber,
            /** Weekdays Mon–Fri that fall inside the requested month. */
            List<DayOfWeek> daysInMonth
    ) {}

    /**
     * Produce the ordered list of Mon–Fri work-weeks touching the given
     * year+month. Weekend days are never included. Edge weeks at the
     * month boundary expose only the weekdays that actually fall in the
     * month — e.g. for June 2026 starting on a Monday, week 1 is Mon–Fri
     * Jun 1–5; for a month starting on a Wednesday, week 1's
     * {@code daysInMonth} is {@code [WEDNESDAY, THURSDAY, FRIDAY]}.
     */
    public static List<WorkWeek> workWeeksOf(YearMonth ym) {
        if (ym == null) throw new IllegalArgumentException("YearMonth is required");
        LocalDate monthStart = ym.atDay(1);
        LocalDate monthEnd = ym.atEndOfMonth();

        // Anchor on the Monday of the week containing the first day of the month.
        LocalDate weekStart = monthStart.with(DayOfWeek.MONDAY);
        // If the month starts mid-week (e.g. Wed), `with(MONDAY)` returns
        // the previous Monday — which is correct: that week is partially
        // in the prior month, but slot 1 still anchors there.

        List<WorkWeek> out = new ArrayList<>();
        int weekNumber = 0;
        while (!weekStart.isAfter(monthEnd)) {
            weekNumber++;
            List<DayOfWeek> daysInMonth = new ArrayList<>(5);
            for (int i = 0; i < 5; i++) { // Mon..Fri
                LocalDate d = weekStart.plusDays(i);
                if (!d.isBefore(monthStart) && !d.isAfter(monthEnd)) {
                    daysInMonth.add(DayOfWeek.of(i + 1));
                }
            }
            if (!daysInMonth.isEmpty()) {
                out.add(new WorkWeek(weekStart, weekNumber, daysInMonth));
            } else {
                // No weekdays of this week land in the month — skip
                // (shouldn't happen for a Mon-anchored week, but defensive).
                weekNumber--;
            }
            weekStart = weekStart.plusDays(7);
        }
        return out;
    }

    /** Convenience — Set form for quick "is this day visible?" lookups. */
    public static Set<DayOfWeek> asSet(List<DayOfWeek> days) {
        return days.isEmpty() ? EnumSet.noneOf(DayOfWeek.class) : EnumSet.copyOf(days);
    }
}
