package com.skyzen.careers.repository;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    /** Users that include the given role in their {@code roles} set. */
    @Query("SELECT u FROM User u JOIN u.roles r WHERE r = :role ORDER BY u.fullName")
    List<User> findByRole(@Param("role") UserRole role);
}
