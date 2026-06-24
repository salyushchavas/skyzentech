package com.skyzen.careers.mail.repository;

import com.skyzen.careers.mail.entity.MailRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MailRuleRepository extends JpaRepository<MailRule, UUID> {

    List<MailRule> findByAccountIdOrderByPriorityAscCreatedAtAsc(UUID accountId);

    List<MailRule> findByAccountIdAndEnabledTrueOrderByPriorityAscCreatedAtAsc(UUID accountId);

    Optional<MailRule> findByIdAndAccountId(UUID id, UUID accountId);

    long countByAccountId(UUID accountId);
}
