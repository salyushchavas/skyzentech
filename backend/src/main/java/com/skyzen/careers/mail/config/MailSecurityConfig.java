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
import org.springframework.web.cors.CorsConfigurationSource;

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
    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    @Order(1)
    public SecurityFilterChain mailFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/mail/**")
                // CORS wired explicitly into THIS chain via the shared
                // CorsConfigurationSource bean from CorsConfig. Without this
                // the @Order(1) mail chain was processing requests before the
                // global CorsFilter could attach Access-Control-Allow-Origin
                // for cross-origin callers (live https://www.skyzentech.com
                // hitting /api/mail/** directly on Railway, not via Vercel
                // rewrite), producing the visible "blocked by CORS" failures.
                // Wiring the source here adds Spring Security's own CorsFilter
                // INSIDE this chain — preflight + response headers now use the
                // SAME allowed-origins list as the careers chain (single
                // source of truth at ${cors.allowed-origins} / CORS_ORIGINS).
                .cors(c -> c.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // SSE fix — /api/mail/events returns an SseEmitter.
                        // Spring Security 6's AuthorizationFilter defaults to
                        // filtering ALL dispatcher types, including ASYNC. On
                        // SSE completion / timeout / error Tomcat re-dispatches
                        // the request through the filter chain; the
                        // SecurityContext is empty on the async thread, so the
                        // re-evaluation throws AccessDeniedException and Tomcat
                        // can't render it (response is already committed),
                        // surfacing as ERROR-level "Unable to handle the
                        // Spring Security Exception because the response is
                        // already committed" stack traces. Restricting the
                        // AuthorizationFilter to the initial REQUEST dispatch
                        // skips the spurious re-check on ASYNC/ERROR/FORWARD/
                        // INCLUDE without weakening any real authorization
                        // boundary — the initial request already enforced auth.
                        .shouldFilterAllDispatcherTypes(false)
                        // CORS preflight — http.cors() above also handles this,
                        // but the explicit permitAll is kept as a belt-and-braces
                        // guarantee (no behaviour change vs. before this fix).
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
