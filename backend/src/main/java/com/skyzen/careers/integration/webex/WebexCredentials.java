package com.skyzen.careers.integration.webex;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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
 * Singleton-row token store for the WebEx Service App. Unlike Zoom's
 * Server-to-Server grant (stateless re-auth from {@code account_credentials}),
 * WebEx requires a persisted refresh token: each {@code grant_type=refresh_token}
 * call returns a NEW refresh token whose lifetime resets the 90-day window. If
 * the refresh token is lost or unused for 90 days, the integration is dead
 * until an operator re-seeds it from a Control Hub bootstrap flow.
 *
 * <p>Singleton constraint via {@code singleton_key='current'} +
 * {@code uq_webex_credentials_singleton} — there is only ever one row.
 * {@link com.skyzen.careers.integration.webex.WebexService} reads it on
 * every refresh and writes back the rotated pair.</p>
 *
 * <p>Both {@code refresh_token} and {@code access_token} are stored as the
 * standard base64(IV||ct+tag) envelope produced by
 * {@link com.skyzen.careers.security.PiiEncryptionService}. Lengths are
 * generous (4096) so re-encryption with a longer envelope never overflows.</p>
 */
@Entity
@Table(
        name = "webex_credentials",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_webex_credentials_singleton",
                columnNames = "singleton_key")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebexCredentials {

    /** The literal {@link #singletonKey} value every row carries. */
    public static final String SINGLETON_KEY = "current";

    @Id
    @GeneratedValue
    private UUID id;

    /**
     * Always {@code "current"} — paired with the unique constraint to enforce
     * one-row-only. Lets us upsert by a stable key without a separate
     * "is_latest" flag or a window query.
     */
    @Column(name = "singleton_key", nullable = false, length = 16)
    @Builder.Default
    private String singletonKey = SINGLETON_KEY;

    /** Encrypted via {@link com.skyzen.careers.security.PiiEncryptionService}. */
    @Column(name = "refresh_token", nullable = false, length = 4096)
    private String refreshToken;

    /**
     * When the refresh token itself expires (WebEx ~90d). If the current
     * instant passes this, the integration is dead until re-seeded.
     */
    @Column(name = "refresh_token_expires_at")
    private Instant refreshTokenExpiresAt;

    /**
     * Optional persisted access-token cache so a process restart doesn't
     * burn a refresh round-trip immediately. Encrypted. May be NULL if the
     * service hasn't acquired one yet.
     */
    @Column(name = "access_token", length = 4096)
    private String accessToken;

    /** When the cached {@link #accessToken} expires (~14d for WebEx). */
    @Column(name = "access_token_expires_at")
    private Instant accessTokenExpiresAt;

    /**
     * Human-readable note about how this row was last written —
     * {@code "seed-env"}, {@code "refresh-rotation"}, {@code "manual-reseed"}.
     * Helps operators trace which path produced the current state without
     * having to inspect logs.
     */
    @Column(name = "last_source", length = 64)
    private String lastSource;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
