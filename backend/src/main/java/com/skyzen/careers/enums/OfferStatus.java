package com.skyzen.careers.enums;

/**
 * Offer envelope lifecycle. Phase 3 doc-spec set is
 * {@code DRAFT, SENT, SIGNED, VOIDED, EXPIRED, DECLINED}. The legacy
 * {@code ACCEPTED} and {@code REVOKED} values stay in the enum so existing
 * audit / DB rows still deserialize; new code writes {@code SIGNED} on the
 * DocuSign webhook and {@code VOIDED} on ERM void.
 */
public enum OfferStatus {
    DRAFT,
    SENT,
    SIGNED,
    VOIDED,
    EXPIRED,
    DECLINED,
    /** @deprecated Pre-DocuSign manual accept. New flow writes {@link #SIGNED}. */
    @Deprecated ACCEPTED,
    /** @deprecated Pre-DocuSign revoke. New flow writes {@link #VOIDED}. */
    @Deprecated REVOKED
}
