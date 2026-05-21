package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Timesheet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TimesheetRepository extends JpaRepository<Timesheet, UUID> {

    /**
     * Staff list for an intern, newest first. Fetch-joins intern.user (for any
     * downstream name lookups) and approvedBy so the DTO mapper can render
     * approvedByName without re-opening a session.
     */
    @Query("SELECT t FROM Timesheet t " +
            "JOIN FETCH t.intern i " +
            "JOIN FETCH i.user iu " +
            "LEFT JOIN FETCH t.approvedBy ab " +
            "WHERE i.id = :candidateId " +
            "ORDER BY t.weekStart DESC, t.createdAt DESC")
    List<Timesheet> findForIntern(@Param("candidateId") UUID candidateId);

    /** Candidate's own timesheets, newest first. */
    @Query("SELECT t FROM Timesheet t " +
            "JOIN FETCH t.intern i " +
            "JOIN FETCH i.user iu " +
            "LEFT JOIN FETCH t.approvedBy ab " +
            "WHERE iu.id = :userId " +
            "ORDER BY t.weekStart DESC, t.createdAt DESC")
    List<Timesheet> findForCandidateUser(@Param("userId") UUID userId);

    /**
     * Full fetch graph for a single timesheet so the candidate-side ownership
     * check ({@code t.intern.user.id == caller.id}) and DTO mapping never touch
     * a detached lazy proxy.
     */
    @Query("SELECT t FROM Timesheet t " +
            "JOIN FETCH t.intern i " +
            "JOIN FETCH i.user iu " +
            "LEFT JOIN FETCH t.approvedBy ab " +
            "WHERE t.id = :id")
    Optional<Timesheet> findByIdWithGraph(@Param("id") UUID id);

    /** Sum of APPROVED hours for an intern. NULL when there are none. */
    @Query("SELECT COALESCE(SUM(t.hours), 0) FROM Timesheet t " +
            "WHERE t.intern.id = :candidateId " +
            "AND t.status = com.skyzen.careers.enums.TimesheetStatus.APPROVED")
    BigDecimal sumApprovedHoursForIntern(@Param("candidateId") UUID candidateId);

    /** Sum of APPROVED hours for an intern resolved by their User id. */
    @Query("SELECT COALESCE(SUM(t.hours), 0) FROM Timesheet t " +
            "WHERE t.intern.user.id = :userId " +
            "AND t.status = com.skyzen.careers.enums.TimesheetStatus.APPROVED")
    BigDecimal sumApprovedHoursForCandidateUser(@Param("userId") UUID userId);
}
