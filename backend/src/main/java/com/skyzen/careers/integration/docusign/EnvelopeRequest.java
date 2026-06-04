package com.skyzen.careers.integration.docusign;

import java.util.Map;
import java.util.UUID;

/**
 * Inputs to {@link DocuSignService#createEnvelopeFromTemplate(EnvelopeRequest)}.
 *
 * @param templateId          DocuSign template id; pass null to fall back to
 *                            {@code docusign.template-id} config.
 * @param recipientName       Display name (e.g., "Jane Doe").
 * @param recipientEmail      Email address; will receive the signing invite.
 * @param recipientClientUserId  When non-null, marks the recipient as an
 *                               embedded signer with this client user id —
 *                               required for the recipient-view (embedded
 *                               signing) flow. Use the applicant's UUID.
 * @param customFields        Template text-tab merge fields. Keys must match
 *                            the tabLabel in the DocuSign template.
 * @param emailSubject        Outer envelope email subject.
 * @param emailBlurb          Outer envelope email body.
 */
public record EnvelopeRequest(
        String templateId,
        String recipientName,
        String recipientEmail,
        UUID recipientClientUserId,
        Map<String, String> customFields,
        String emailSubject,
        String emailBlurb
) {}
