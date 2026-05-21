package com.skyzen.careers.dto.admin;

import com.skyzen.careers.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateUserRequest {

    @NotBlank(message = "name is required")
    private String name;

    @NotBlank(message = "email is required")
    @Email(message = "email must be a valid address")
    private String email;

    /** Must be a STAFF role; CANDIDATE is rejected at the service layer. */
    @NotNull(message = "role is required")
    private UserRole role;

    @NotBlank(message = "initialPassword is required")
    @Size(min = 8, message = "initialPassword must be at least 8 characters")
    private String initialPassword;
}
