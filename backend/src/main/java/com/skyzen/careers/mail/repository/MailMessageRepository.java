package com.skyzen.careers.mail.repository;

import com.skyzen.careers.mail.dto.MailMessageHeader;
import com.skyzen.careers.mail.entity.MailMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MailMessageRepository extends JpaRepository<MailMessage, UUID> {

    List<MailMessage> findByThreadId(UUID threadId);

    /**
     * Metadata-only projection (no body columns) so listings/search never invoke
     * the AES converter — bodies are decrypted only when a full MailMessage is
     * loaded for the detail/thread views.
     */
    @Query("select new com.skyzen.careers.mail.dto.MailMessageHeader("
            + "m.id, m.senderAccountId, m.subject, m.threadId, m.hasAttachments) "
            + "from MailMessage m where m.id in :ids")
    List<MailMessageHeader> findHeadersByIdIn(@Param("ids") Collection<UUID> ids);
}
