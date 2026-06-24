package com.skyzen.careers.mail.service;

import com.skyzen.careers.mail.entity.MailFolder;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Per-account SSE registry for real-time new-mail pushes. Maps accountId to its
 * live emitters (a user may have several tabs/devices). A single daemon scheduler
 * sends comment heartbeats every ~25s (keeps proxies from idling the connection)
 * and runs publishes off the request thread.
 *
 * <p>Best-effort + isolated: a failed send only drops that one emitter, never the
 * delivery. SINGLE-INSTANCE limitation — emitters live in this JVM only, so in a
 * multi-instance deployment a push reaches only clients on the same node (the
 * client still resyncs counts on connect, so it is eventually consistent).</p>
 */
@Service
@Slf4j
public class MailSseService {

    private static final long EMITTER_TIMEOUT_MS = 30 * 60 * 1000L;
    private static final long HEARTBEAT_SECONDS = 25;
    /** Bound per-account connections so a flood of /events cannot exhaust memory. */
    private static final int MAX_CONNECTIONS_PER_ACCOUNT = 10;

    private final Map<UUID, Set<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "mail-sse");
        t.setDaemon(true);
        return t;
    });

    public MailSseService() {
        scheduler.scheduleAtFixedRate(this::heartbeat, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
    }

    public SseEmitter register(UUID accountId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        Set<SseEmitter> set = emitters.computeIfAbsent(accountId, k -> new CopyOnWriteArraySet<>());
        // Evict the oldest connections so the set stays bounded and the newest
        // tab/device always connects (no lockout while stale ones age out).
        Iterator<SseEmitter> it = set.iterator();
        while (set.size() >= MAX_CONNECTIONS_PER_ACCOUNT && it.hasNext()) {
            SseEmitter oldest = it.next();
            set.remove(oldest);
            try {
                oldest.complete();
            } catch (RuntimeException ignore) {
                // already done
            }
        }
        set.add(emitter);
        emitter.onCompletion(() -> remove(accountId, emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            remove(accountId, emitter);
        });
        emitter.onError(e -> remove(accountId, emitter));
        trySend(accountId, emitter, "{\"type\":\"READY\"}");
        return emitter;
    }

    /** Fan out a new-mail push to one account's emitters, off the request thread. */
    public void publishNewMail(UUID accountId, MailFolder folder) {
        if (accountId == null || folder == null) {
            return;
        }
        try {
            scheduler.submit(() -> publishNow(accountId, folder));
        } catch (RuntimeException e) {
            // scheduler shutting down — best-effort, ignore
        }
    }

    /** Synchronous fan-out (package-visible for tests). */
    void publishNow(UUID accountId, MailFolder folder) {
        Set<SseEmitter> set = emitters.get(accountId);
        if (set == null || set.isEmpty()) {
            return;
        }
        String payload = "{\"type\":\"NEW_MAIL\",\"folder\":\"" + folder.name() + "\"}";
        for (SseEmitter emitter : set) {
            trySend(accountId, emitter, payload);
        }
    }

    int connectionCount(UUID accountId) {
        Set<SseEmitter> set = emitters.get(accountId);
        return set == null ? 0 : set.size();
    }

    private void heartbeat() {
        for (Map.Entry<UUID, Set<SseEmitter>> e : emitters.entrySet()) {
            for (SseEmitter emitter : e.getValue()) {
                try {
                    emitter.send(SseEmitter.event().comment("hb"));
                } catch (Exception ex) {
                    remove(e.getKey(), emitter);
                }
            }
        }
    }

    private void trySend(UUID accountId, SseEmitter emitter, String data) {
        try {
            emitter.send(SseEmitter.event().data(data));
        } catch (IOException | RuntimeException ex) {
            remove(accountId, emitter);
            try {
                emitter.complete();
            } catch (RuntimeException ignore) {
                // already done
            }
        }
    }

    private void remove(UUID accountId, SseEmitter emitter) {
        Set<SseEmitter> set = emitters.get(accountId);
        if (set != null) {
            set.remove(emitter);
            if (set.isEmpty()) {
                emitters.remove(accountId, set);
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
        emitters.values().forEach(set -> set.forEach(emitter -> {
            try {
                emitter.complete();
            } catch (RuntimeException ignore) {
                // already done
            }
        }));
        emitters.clear();
    }
}
