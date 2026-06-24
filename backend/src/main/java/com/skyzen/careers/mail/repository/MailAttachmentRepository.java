package com.skyzen.careers.mail.repository;

import com.skyzen.careers.mail.entity.MailAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MailAttachmentRepository extends JpaRepository<MailAttachment, UUID> {

    List<MailAttachment> findByMessageId(UUID messageId);

    long countByMessageId(UUID messageId);
}
