package com.skyzen.careers.integration.meeting;

import com.skyzen.careers.integration.webex.WebexService;
import com.skyzen.careers.integration.zoom.ZoomService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Selects which {@link MeetingProvider} implementation Spring wires as the
 * {@code @Primary} bean for consumer injection. Driven by the
 * {@code MEETING_PROVIDER} env variable (Spring relaxed binding maps it onto
 * the {@code meeting.provider} property).
 *
 * <ul>
 *   <li>{@code MEETING_PROVIDER=zoom} (default — unset value also resolves
 *       here): existing behaviour. Consumers that inject
 *       {@link MeetingProvider} get the Zoom adapter; legacy consumers that
 *       still inject {@link ZoomService} directly continue to work unchanged.</li>
 *   <li>{@code MEETING_PROVIDER=webex}: {@link WebexService} becomes the
 *       primary. Consumers using {@link MeetingProvider} route through the
 *       WebEx adapter. <b>Until the consumer-migration phase lands</b>,
 *       existing consumers still call {@code ZoomService} directly and will
 *       continue using Zoom regardless of this flag — flipping the env var
 *       alone does not redirect existing flows. The flag exists now so the
 *       admin health endpoint + a future test-only meeting probe can resolve
 *       to WebEx for verification before consumers are switched.</li>
 * </ul>
 *
 * <p>Both implementations remain registered as their own service beans
 * (Spring component-scan); this config only decides which one wins the
 * unqualified {@link MeetingProvider} injection.</p>
 */
@Configuration
@Slf4j
public class MeetingProviderConfig {

    /** Stable string values for the {@code MEETING_PROVIDER} env. */
    public static final String PROVIDER_ZOOM = "zoom";
    public static final String PROVIDER_WEBEX = "webex";

    @Value("${meeting.provider:zoom}")
    private String selectedProvider;

    @Bean
    @Primary
    public MeetingProvider primaryMeetingProvider(ZoomService zoomService,
                                                   WebexService webexService) {
        String pick = selectedProvider == null
                ? PROVIDER_ZOOM
                : selectedProvider.trim().toLowerCase();
        MeetingProvider chosen = switch (pick) {
            case PROVIDER_WEBEX -> webexService;
            case PROVIDER_ZOOM -> zoomService;
            default -> {
                log.warn("[MeetingProvider] unknown MEETING_PROVIDER='{}' — defaulting to zoom",
                        selectedProvider);
                yield zoomService;
            }
        };
        log.info("[MeetingProvider] @Primary bound to '{}' (ready={}, forceDisabled={})",
                chosen.providerName(), chosen.isReady(), chosen.isForceDisabled());
        return chosen;
    }
}
