package com.skyzen.careers.dto.evaluation;

import com.skyzen.careers.enums.RubricCriterion;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvaluationRubricScoreResponse {
    private UUID id;
    private RubricCriterion criterion;
    private Integer score;
    private String note;
}
