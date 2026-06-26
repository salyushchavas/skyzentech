package com.skyzen.careers.integration.meeting;

import com.skyzen.careers.integration.webex.WebexService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Binds {@link WebexService} as the unconditional {@code @Primary}
 * {@link MeetingProvider} for consumer injection. Zoom was removed once
 * WebEx createMeeting was verified live (probe meeting auto-deleted by the
 * SUPER_ADMIN test-create endpoint, returning a valid {@code webLink} for
 * host {@code techteam@skyzentech.com} on
 * {@code charminfosystems-780.my.webex.com}).
 *
 * <p>The legacy {@code MEETING_PROVIDER} env switch is gone too — there's
 * only one provider now. If a future migration needs to add another
 * provider alongside WebEx, reintroduce a selector at that point.</p>
 */
@Configuration
@Slf4j
public class MeetingProviderConfig {

    @Bean
    @Primary
    public MeetingProvider primaryMeetingProvider(WebexService webexService) {
        log.info("[MeetingProvider] @Primary bound to '{}' (ready={}, forceDisabled={})",
                webexService.providerName(), webexService.isReady(),
                webexService.isForceDisabled());
        return webexService;
    }
}
