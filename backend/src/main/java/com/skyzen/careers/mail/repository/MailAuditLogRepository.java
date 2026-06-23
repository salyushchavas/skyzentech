package com.skyzen.careers.mail.repository;

import com.skyzen.careers.mail.entity.MailAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MailAuditLogRepository extends JpaRepository<MailAuditLog, UUID> {
}
