package com.skyzen.careers.repository;

import com.skyzen.careers.entity.ScreeningQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ScreeningQuestionRepository extends JpaRepository<ScreeningQuestion, UUID> {
    List<ScreeningQuestion> findAllByOrderByOrderIndexAsc();
}
