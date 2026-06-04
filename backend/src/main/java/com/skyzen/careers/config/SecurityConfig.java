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
                        // Phase 3 — DocuSign Connect webhook. HMAC-verified
                        // inside the controller; no Spring Security gate.
                        .requestMatchers(HttpMethod.POST, "/api/v1/webhooks/docusign").permitAll()
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
