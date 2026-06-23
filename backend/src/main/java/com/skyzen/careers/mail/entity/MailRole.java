package com.skyzen.careers.mail.entity;

/**
 * Authority role for a mail account. Deliberately DISTINCT from Skyzen's
 * {@code com.skyzen.careers.enums.UserRole} — the mail security chain grants
 * authorities as {@code "MAIL_" + role.name()} (e.g. MAIL_SUPER_ADMIN) and
 * authorizes with {@code hasAuthority(...)}, never {@code hasRole(...)}. This
 * makes mail authorities non-overlapping with Skyzen's {@code ROLE_*} world.
 */
public enum MailRole {
    USER,
    ADMIN,
    SUPER_ADMIN
}
