package com.skyzen.careers.dto.offer;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeclineOfferRequest {
    private String reason;
}
