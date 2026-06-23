package com.skyzen.careers.mail.repository;

import com.skyzen.careers.mail.entity.MailDomain;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MailDomainRepository extends JpaRepository<MailDomain, UUID> {

    Optional<MailDomain> findByName(String name);

    boolean existsByName(String name);

    List<MailDomain> findAllByOrderByNameAsc();
}
