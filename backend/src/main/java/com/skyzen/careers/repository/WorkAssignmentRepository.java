package com.skyzen.careers.repository;

import com.skyzen.careers.entity.WorkAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkAssignmentRepository extends JpaRepository<WorkAssignment, UUID> {

    /**
     * Staff list of an intern's assignments. Fetch-joins intern.user (for the
     * future case of needing intern name) and assignedBy so the DTO mapper can
     * read fullName without re-opening a session. Newest first.
     */
    @Query("SELECT wa FROM WorkAssignment wa " +
            "JOIN FETCH wa.intern i " +
            "JOIN FETCH i.user iu " +
            "JOIN FETCH wa.assignedBy ab " +
            "WHERE i.id = :candidateId " +
            "ORDER BY wa.createdAt DESC")
    List<WorkAssignment> findForIntern(@Param("candidateId") UUID candidateId);

    /**
     * Candidate's own assignments. Same fetch graph as the staff list so the
     * DTO mapper can populate assignedByName.
     */
    @Query("SELECT wa FROM WorkAssignment wa " +
            "JOIN FETCH wa.intern i " +
            "JOIN FETCH i.user iu " +
            "JOIN FETCH wa.assignedBy ab " +
            "WHERE iu.id = :userId " +
            "ORDER BY wa.createdAt DESC")
    List<WorkAssignment> findForCandidateUser(@Param("userId") UUID userId);

    /**
     * Single assignment with intern + intern.user eagerly loaded so the
     * ownership check ({@code wa.intern.user.id == caller.id}) doesn't trip
     * a LazyInitializationException after the transaction closes.
     */
    @Query("SELECT wa FROM WorkAssignment wa " +
            "JOIN FETCH wa.intern i " +
            "JOIN FETCH i.user iu " +
            "JOIN FETCH wa.assignedBy ab " +
            "WHERE wa.id = :id")
    Optional<WorkAssignment> findByIdWithGraph(@Param("id") UUID id);
}
