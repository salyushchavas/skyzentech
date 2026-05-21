package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Timesheet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TimesheetRepository extends JpaRepository<Timesheet, UUID> {
    List<Timesheet> findByInternIdOrderByWeekStartDesc(UUID internId);
}
