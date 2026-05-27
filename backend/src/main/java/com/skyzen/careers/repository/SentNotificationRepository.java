package com.skyzen.careers.repository;

import com.skyzen.careers.entity.SentNotification;
import com.skyzen.careers.notification.NotificationEventType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SentNotificationRepository extends JpaRepository<SentNotification, UUID> {

    boolean existsByEventTypeAndTargetId(NotificationEventType eventType, UUID targetId);
}
