package com.skyzen.careers.config;

import com.skyzen.careers.auth.CustomAccessDeniedHandler;
import com.skyzen.careers.auth.CustomAuthenticationEntryPoint;
import com.skyzen.careers.auth.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomAuthenticationEntryPoint authenticationEntryPoint;
    private final CustomAccessDeniedHandler accessDeniedHandler;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/auth/register",
                                "/auth/login",
                                // /auth/refresh MUST be reachable without
                                // a valid access token — the whole point
                                // is to redeem a refresh token AFTER the
                                // access token expired. JwtAuthenticationFilter
                                // already SKIP_PATHS this URL, so without
                                // permitAll the request falls through to
                                // .anyRequest().authenticated() and 401s
                                // before AuthService.refresh runs. The
                                // refresh-token credential itself is
                                // validated (existence + ownership + not
                                // revoked + not expired) inside
                                // SessionTokenService.rotate.
                                "/auth/refresh",
                                "/auth/forgot-password",
                                "/auth/reset-password",
                                "/auth/verify-email",
                                "/auth/resend-verification"
                        ).permitAll()
                        .requestMatchers("/health", "/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/job-postings").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/job-postings/*").permitAll()
                        // Phase 2 — public read of the doc-spec /jobs endpoints.
                        .requestMatchers(HttpMethod.GET, "/api/v1/jobs").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/jobs/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/jobs/featured").permitAll()
                        // Signing is now IDMS (in-house) — no inbound
                        // third-party webhook endpoint to permit. The
                        // applicant signs at /careers/intern/offer/sign/{id}.
                        .requestMatchers("/api/v1/**").authenticated()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
