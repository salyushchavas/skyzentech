package com.skyzen.careers.mail.service;

import com.skyzen.careers.mail.entity.MailFolder;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Registry semantics for the SSE service (per-account isolation + best-effort no
 * throws). The live wire protocol (heartbeats, actual pushes over a real
 * connection) needs a servlet container and is reported UNVERIFIED here.
 */
class MailSseServiceTest {

    @Test
    void register_tracksConnectionsPerAccount_isolated() {
        MailSseService svc = new MailSseService();
        try {
            UUID a = UUID.randomUUID();
            UUID b = UUID.randomUUID();
            assertEquals(0, svc.connectionCount(a));
            svc.register(a);
            svc.register(a); // a second tab/device
            svc.register(b);
            assertEquals(2, svc.connectionCount(a));
            assertEquals(1, svc.connectionCount(b));
        } finally {
            svc.shutdown();
        }
    }

    @Test
    void publishNow_toUnknownAccount_isNoop() {
        MailSseService svc = new MailSseService();
        try {
            assertDoesNotThrow(() -> svc.publishNow(UUID.randomUUID(), MailFolder.INBOX));
        } finally {
            svc.shutdown();
        }
    }

    @Test
    void publishNewMail_nullArgs_neverThrows() {
        MailSseService svc = new MailSseService();
        try {
            assertDoesNotThrow(() -> svc.publishNewMail(null, null));
        } finally {
            svc.shutdown();
        }
    }
}
