package com.skyzen.careers.mail.config;

import com.skyzen.careers.mail.auth.MailAccessDeniedHandler;
import com.skyzen.careers.mail.auth.MailAuthenticationEntryPoint;
import com.skyzen.careers.mail.auth.MailJwtAuthenticationFilter;
import com.skyzen.careers.mail.auth.MailJwtUtil;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Parallel security chain for the mail module. It is added ALONGSIDE Skyzen's
 * single chain WITHOUT modifying it:
 * <ul>
 *   <li>{@code @Order(1)} + {@code securityMatcher("/api/mail/**")} → this chain
 *       handles only mail routes; Spring Security's first-match-wins selection
 *       leaves Skyzen's no-order/no-matcher catch-all chain as the fallback for
 *       everything else, untouched.</li>
 *   <li>The {@link MailJwtAuthenticationFilter} is instantiated here as a plain
 *       object (not a bean) so it is NOT globally servlet-registered — it runs
 *       only within this chain.</li>
 *   <li>Authorities are checked with {@code hasAuthority("MAIL_*")} only —
 *       never {@code hasRole}/{@code ROLE_} — so there is zero overlap with
 *       Skyzen's role world.</li>
 * </ul>
 *
 * <p><b>Must-change gate:</b> a pre-change principal carries only
 * {@code MAIL_PRECHANGE}, so {@code authenticated()} routes ({@code /me} +
 * change-password) admit it while every {@code hasAuthority(MAIL_USER|ADMIN|
 * SUPER_ADMIN)} route rejects it with 403.</p>
 */
@Configuration
@RequiredArgsConstructor
public class MailSecurityConfig {

    private final MailJwtUtil mailJwtUtil;
    private final MailAccountRepository mailAccountRepository;
    private final MailAuthenticationEntryPoint mailAuthenticationEntryPoint;
    private final MailAccessDeniedHandler mailAccessDeniedHandler;

    @Bean
    @Order(1)
    public SecurityFilterChain mailFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/mail/**")
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // CORS preflight (the global CorsFilter sets the headers).
                        .requestMatchers(HttpMethod.OPTIONS, "/api/mail/**").permitAll()
                        // Auth endpoints are open (login / refresh / logout).
                        .requestMatchers("/api/mail/auth/**").permitAll()
                        // Any authenticated principal (incl. pre-change) may read
                        // /me and change their password — the way OUT of the gate.
                        .requestMatchers(HttpMethod.GET, "/api/mail/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/mail/me/change-password").authenticated()
                        // Admin surface.
                        .requestMatchers("/api/mail/admin/**")
                            .hasAnyAuthority("MAIL_ADMIN", "MAIL_SUPER_ADMIN")
                        // Everything else under /api/mail/** needs a full (non
                        // pre-change) role authority.
                        .requestMatchers("/api/mail/**")
                            .hasAnyAuthority("MAIL_USER", "MAIL_ADMIN", "MAIL_SUPER_ADMIN")
                        .anyRequest().denyAll()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(mailAuthenticationEntryPoint)
                        .accessDeniedHandler(mailAccessDeniedHandler)
                )
                .addFilterBefore(
                        new MailJwtAuthenticationFilter(mailJwtUtil, mailAccountRepository),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
