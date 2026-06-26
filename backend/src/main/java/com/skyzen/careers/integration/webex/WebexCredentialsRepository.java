package com.skyzen.careers.integration.webex;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for the singleton {@link WebexCredentials} row. The unique
 * constraint on {@code singleton_key} ensures {@link #findCurrent} returns
 * either the one row or empty.
 */
@Repository
public interface WebexCredentialsRepository extends JpaRepository<WebexCredentials, UUID> {

    Optional<WebexCredentials> findBySingletonKey(String singletonKey);

    default Optional<WebexCredentials> findCurrent() {
        return findBySingletonKey(WebexCredentials.SINGLETON_KEY);
    }
}
