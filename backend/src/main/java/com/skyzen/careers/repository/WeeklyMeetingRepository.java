package com.skyzen.careers.repository;

import com.skyzen.careers.entity.WeeklyMeeting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeeklyMeetingRepository extends JpaRepository<WeeklyMeeting, UUID> {

    List<WeeklyMeeting> findByInternLifecycleIdOrderByScheduledForAsc(UUID internLifecycleId);

    List<WeeklyMeeting> findByHostUserIdOrderByScheduledForDesc(UUID hostUserId);

    List<WeeklyMeeting> findByRecurrenceParentIdOrderByScheduledForAsc(UUID parentId);

    Optional<WeeklyMeeting> findFirstByZoomMeetingId(String zoomMeetingId);
}
