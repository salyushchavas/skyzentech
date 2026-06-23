package com.skyzen.careers.mail.auth;

import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * JWT auth filter for the mail chain.
 *
 * <p><b>Isolation — the #1 requirement:</b> this class is intentionally NOT a
 * {@code @Component} / Spring bean. Skyzen auto-registers its {@code @Component}
 * {@code OncePerRequestFilter}s as GLOBAL servlet filters (no
 * {@code FilterRegistrationBean} suppresses it), so any mail filter that were a
 * bean would also run on Skyzen routes. By instantiating this filter directly in
 * {@link com.skyzen.careers.mail.config.MailSecurityConfig} and adding it via
 * {@code http.addFilterBefore(...)}, it is never picked up by servlet
 * auto-registration — it runs ONLY inside the {@code /api/mail/**} chain.</p>
 *
 * <p><b>Must-change gate:</b> when the account's {@code mustChangePassword} flag
 * (DB source of truth) is set, the principal is granted ONLY
 * {@code MAIL_PRECHANGE} — never its role authority — so it can reach only
 * {@code /me} + change-password; every other mail route 403s.</p>
 */
@Slf4j
public class MailJwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String PRECHANGE_AUTHORITY = "MAIL_PRECHANGE";
    public static final String AUTHORITY_PREFIX = "MAIL_";

    private final MailJwtUtil mailJwtUtil;
    private final MailAccountRepository mailAccountRepository;

    public MailJwtAuthenticationFilter(MailJwtUtil mailJwtUtil,
                                       MailAccountRepository mailAccountRepository) {
        this.mailJwtUtil = mailJwtUtil;
        this.mailAccountRepository = mailAccountRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                var claims = mailJwtUtil.parseToken(token);
                UUID accountId = mailJwtUtil.extractAccountId(claims);
                Optional<MailAccount> acctOpt = mailAccountRepository.findById(accountId);
                if (acctOpt.isPresent() && acctOpt.get().getStatus() == MailAccountStatus.ACTIVE) {
                    MailAccount acct = acctOpt.get();
                    boolean mustChange = Boolean.TRUE.equals(acct.getMustChangePassword());
                    String authority = mustChange
                            ? PRECHANGE_AUTHORITY
                            : AUTHORITY_PREFIX + acct.getRole().name();
                    String email = acct.getLocalPart() + "@" + acct.getDomain().getName();
                    MailPrincipal principal = new MailPrincipal(
                            acct.getId(), email, acct.getDisplayName(),
                            acct.getDomain().getId(), acct.getRole(), mustChange);
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(
                                    principal, null, List.of(new SimpleGrantedAuthority(authority)));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception ex) {
                log.debug("Mail JWT validation failed: {}", ex.getMessage());
            }
        }
        chain.doFilter(request, response);
    }
}
