package com.skyzen.careers.repository;

import com.skyzen.careers.entity.I9Form;
import com.skyzen.careers.enums.I9Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface I9FormRepository extends JpaRepository<I9Form, UUID> {

    Optional<I9Form> findByCandidateId(UUID candidateId);

    Page<I9Form> findByStatusOrderByUpdatedAtDesc(I9Status status, Pageable pageable);

    Page<I9Form> findAllByOrderByUpdatedAtDesc(Pageable pageable);

    List<I9Form> findByStatusAndFirstDayOfEmploymentBefore(I9Status status, LocalDate cutoff);

    /** Count of I-9 forms NOT yet in {@link I9Status#COMPLETED}. */
    long countByStatusNot(I9Status status);

    /**
     * Single form with candidate → user eagerly loaded so DTO mappers and
     * controller-side toResponse calls don't trip a LazyInitializationException
     * after the service's transaction closes.
     */
    @Query("SELECT f FROM I9Form f " +
            "JOIN FETCH f.candidate c " +
            "JOIN FETCH c.user u " +
            "WHERE f.id = :id")
    Optional<I9Form> findByIdWithGraph(@Param("id") UUID id);

    /** Same fetch graph keyed by candidate id, used by getMyForm/getOrCreateForCandidate. */
    @Query("SELECT f FROM I9Form f " +
            "JOIN FETCH f.candidate c " +
            "JOIN FETCH c.user u " +
            "WHERE c.id = :candidateId")
    Optional<I9Form> findByCandidateIdWithGraph(@Param("candidateId") UUID candidateId);
}
