package com.skyzen.careers.mail.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * A per-account, delivery-time inbox rule. Conditions/actions are stored as JSON
 * TEXT (rule config, NOT message content — so the AES body converter does not
 * apply). Evaluated by {@code MailRuleEngine} in priority order at delivery; a
 * failure to evaluate a rule must never drop a message (fail-open to INBOX).
 */
@Entity
@Table(name = "mail_rules",
        indexes = @Index(name = "idx_mail_rule_account", columnList = "account_id, priority"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MailRule {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(nullable = false, length = 120)
    private String name;

    /** Lower runs first. */
    @Column(nullable = false)
    @Builder.Default
    private int priority = 100;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "match_mode", nullable = false, length = 8)
    @Builder.Default
    private MailRuleMatchMode matchMode = MailRuleMatchMode.ALL;

    /** When true, a matching rule stops evaluation of lower-priority rules. */
    @Column(name = "stop_processing", nullable = false)
    @Builder.Default
    private boolean stopProcessing = false;

    @Column(name = "conditions_json", nullable = false, columnDefinition = "TEXT")
    private String conditionsJson;

    @Column(name = "actions_json", nullable = false, columnDefinition = "TEXT")
    private String actionsJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
