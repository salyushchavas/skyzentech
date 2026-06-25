package com.skyzen.careers.bootstrap;

import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.entity.MailDomain;
import com.skyzen.careers.mail.entity.MailRole;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.repository.MailDomainRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mail bridge Phase 1 — seeds the five functional sender mailboxes Phase-2
 * internal notifications will be sent FROM:
 * {@code noreply@}, {@code erm@}, {@code trainer@}, {@code evaluator@},
 * {@code manager@}, all on the configured domain (default
 * {@code skyzentech.com} — same key {@link MailAdminSeeder} uses).
 *
 * <p>Idempotent: each (local_part, domain) is created only when missing,
 * so re-runs are a silent no-op. Mirrors {@code MailAdminSeeder}'s exact
 * shape — same repositories, same {@link MailAccount.MailAccountBuilder}
 * fields, same {@link PasswordEncoder} bean.</p>
 *
 * <p>These are <b>send-only service accounts</b>: no human ever signs in
 * with them, so {@code mustChangePassword} and {@code requireChangeOnFirstLogin}
 * are both {@code false}. The password is a strong random per-row secret;
 * Phase 2 / 3 will switch the dispatcher to in-process delivery via
 * {@link com.skyzen.careers.mail.service.MailMessageService}, so the
 * password is never used by anything that ships in this phase.</p>
 *
 * <p>{@code @Order(8)} — runs immediately after {@link MailAdminSeeder}
 * ({@code @Order(7)}) so the mail tables are guaranteed to exist (ddl-auto
 * creates them at boot, before any runner), and the domain is ensured
 * here regardless of whether the admin seeder ran (it's gated on
 * {@code SEED_MAIL_ADMIN}).</p>
 *
 * <p>Never crashes startup (try/catch around the whole pass; per-account
 * failures isolated).</p>
 */
@Component
@Order(8)
@RequiredArgsConstructor
@Slf4j
public class MailRoleAccountSeeder implements CommandLineRunner {

    private final MailDomainRepository domainRepository;
    private final MailAccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.webmail.seed.admin-domain:skyzentech.com}")
    private String adminDomain;

    /**
     * Local-part → display name. Order matters only for the log line; the
     * domain ensure + per-account check are independent.
     */
    private static final Map<String, String> ROLE_ACCOUNTS = new LinkedHashMap<>();
    static {
        ROLE_ACCOUNTS.put("noreply",   "Skyzen Notifications");
        ROLE_ACCOUNTS.put("erm",       "Skyzen ERM");
        ROLE_ACCOUNTS.put("trainer",   "Skyzen Trainer");
        ROLE_ACCOUNTS.put("evaluator", "Skyzen Evaluator");
        ROLE_ACCOUNTS.put("manager",   "Skyzen Manager");
    }

    @Override
    public void run(String... args) {
        try {
            String domainName = (adminDomain == null || adminDomain.isBlank())
                    ? "skyzentech.com"
                    : adminDomain.trim().toLowerCase();

            // Ensure the mail domain — same shape as MailAdminSeeder.
            MailDomain domain = domainRepository.findByName(domainName).orElseGet(() -> {
                MailDomain created = domainRepository.save(MailDomain.builder()
                        .name(domainName)
                        .displayName(domainName)
                        .active(true)
                        .build());
                log.warn("MailRoleAccountSeeder: created mail domain '{}'", domainName);
                return created;
            });

            int created = 0;
            int existing = 0;
            for (Map.Entry<String, String> e : ROLE_ACCOUNTS.entrySet()) {
                String localPart = e.getKey();
                String displayName = e.getValue();
                try {
                    if (accountRepository.findByLocalPartAndDomain_Name(localPart, domainName).isPresent()) {
                        existing++;
                        continue;
                    }
                    accountRepository.save(MailAccount.builder()
                            .domain(domain)
                            .localPart(localPart)
                            .displayName(displayName)
                            .passwordHash(passwordEncoder.encode(randomPassword()))
                            .role(MailRole.USER)
                            .status(MailAccountStatus.ACTIVE)
                            .mustChangePassword(false)
                            .requireChangeOnFirstLogin(false)
                            .build());
                    created++;
                } catch (Exception perRow) {
                    log.warn("MailRoleAccountSeeder: failed to create {}@{} (non-fatal): {}",
                            localPart, domainName, perRow.getMessage());
                }
            }

            log.info("MailRoleAccountSeeder: role mailboxes on '{}' — created={}, already-present={}",
                    domainName, created, existing);
        } catch (Exception e) {
            log.warn("MailRoleAccountSeeder failed (non-fatal): {}", e.getMessage(), e);
        }
    }

    /**
     * 32 random bytes → URL-safe Base64 (44 chars). These are send-only
     * service accounts — no human ever signs in — so the password just
     * has to be unguessable. We never log it or expose it; the BCrypt
     * hash is what's persisted.
     */
    private static String randomPassword() {
        byte[] buf = new byte[32];
        new SecureRandom().nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }
}
