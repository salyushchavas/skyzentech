package com.skyzen.careers.mail.listener;

import com.skyzen.careers.mail.event.MailDeliveredEvent;
import com.skyzen.careers.mail.service.MailSseService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Fans delivery events out to SSE subscribers AFTER the delivery transaction
 * commits, so a notified client never re-fetches before the row is visible.
 * Best-effort: {@link MailSseService#publishNewMail} never throws, so a push
 * failure cannot affect the (already-committed) delivery.
 */
@Component
@RequiredArgsConstructor
public class MailDeliveryListener {

    private final MailSseService sseService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMailDelivered(MailDeliveredEvent event) {
        sseService.publishNewMail(event.accountId(), event.folder());
    }
}
