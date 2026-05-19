# Skyzen Careers — Backend

Skyzen Careers backend — Spring Boot + PostgreSQL on Railway. New STEM intern lifecycle management module to be deployed at `skyzentech.com/careers`. Coexists with the existing PHP jobs system on skyzentech.com (`jobs.php` and related files) — does not replace it.

This service powers the STEM internship lifecycle (reverse-proxied to the Next.js frontend, which talks to this API). The existing PHP-based job system stays in use for general/full-time hires.

## Stack

- Spring Boot 3.3+ (Java 17)
- Maven
- PostgreSQL (JPA / Hibernate)
- Spring Security + JJWT
- Lombok

## Required environment variables

| Variable           | Description                                                                  | Example                                                |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `DB_URL`           | JDBC URL for the database                                                    | `jdbc:postgresql://localhost:5432/skyzen_careers`      |
| `DB_USERNAME`      | DB username                                                                  | `postgres`                                             |
| `DB_PASSWORD`      | DB password                                                                  | `postgres`                                             |
| `DB_DRIVER`        | JDBC driver class                                                            | `org.postgresql.Driver`                                |
| `DB_DIALECT`       | Hibernate dialect                                                            | `org.hibernate.dialect.PostgreSQLDialect`              |
| `PORT`             | HTTP port (defaults to `8080`)                                               | `8080`                                                 |
| `JWT_SECRET`       | Secret used to sign JWTs — must be a long random string (>= 32 bytes)        | `change-me-to-a-long-random-string-of-32-bytes-or-more`|
| `JWT_EXPIRY_HOURS` | Token lifetime in hours (defaults to `24`)                                   | `24`                                                   |
| `CORS_ORIGINS`     | Comma-separated list of allowed origins for CORS                             | `http://localhost:3000,https://skyzentech.com`         |
| `ADMIN_EMAIL`      | Optional. Email of the bootstrap admin created on first startup if no admin exists. Defaults to `admin@skyzen.test`. | `admin@skyzen.test` |
| `ADMIN_PASSWORD`   | Optional. Plaintext password for the bootstrap admin (hashed with BCrypt before storing). Defaults to `admin12345`. **Change in any non-dev environment.** | `admin12345` |

> The application reads `DB_*` (not `SPRING_DATASOURCE_*`) for portability across Railway / local / CI. Do not override with `SPRING_DATASOURCE_*`.

## Local setup

1. Install Java 17+ and Maven 3.9+.
2. Create a local PostgreSQL database named `skyzen_careers`.
3. Export environment variables (PowerShell example):

   ```powershell
   $env:DB_URL = "jdbc:postgresql://localhost:5432/skyzen_careers"
   $env:DB_USERNAME = "postgres"
   $env:DB_PASSWORD = "postgres"
   $env:DB_DRIVER = "org.postgresql.Driver"
   $env:DB_DIALECT = "org.hibernate.dialect.PostgreSQLDialect"
   $env:JWT_SECRET = "replace-with-a-long-random-secret-at-least-32-bytes"
   $env:JWT_EXPIRY_HOURS = "24"
   $env:CORS_ORIGINS = "http://localhost:3000"
   ```

4. Run:

   ```bash
   mvn spring-boot:run
   ```

5. Verify:

   ```bash
   curl http://localhost:8080/health
   # {"status":"OK"}
   ```

## Project layout

```
src/main/java/com/skyzen/careers/
├── SkyzenCareersApplication.java
├── config/        CORS + Security configuration
├── controller/    REST controllers (currently: HealthController)
├── entity/        JPA entities
├── enums/         Domain enums
└── repository/    Spring Data JPA repositories
```

## Authentication endpoints

Base path: `/auth`. All requests/responses are JSON. JWT is returned in the response body on register/login — clients must send it as `Authorization: Bearer <token>` on protected endpoints.

| Method | Path                    | Auth | Description |
| ------ | ----------------------- | ---- | ----------- |
| POST   | `/auth/register`        | no   | Create a new candidate account. Creates User + Candidate. Returns AuthResponse (token + user info). 409 if email already exists. |
| POST   | `/auth/login`           | no   | Exchange email/password for a JWT. Returns 401 on bad credentials with generic message (does not reveal whether email or password was wrong). |
| POST   | `/auth/forgot-password` | no   | Request a password-reset token. Always returns 200; if the email exists, a 1-hour token is created. In dev, the token is logged at INFO; in later phases it will be emailed. |
| POST   | `/auth/reset-password`  | no   | Consume a reset token and set a new password. Token is single-use and 1-hour TTL. |
| GET    | `/auth/me`              | yes  | Returns the authenticated user's profile (id, email, fullName, phoneNumber, roles, createdAt). |

### Example curl

Register:

```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"candidate1@example.com","password":"hunter22!","fullName":"Candidate One","phoneNumber":"+91-9000000001"}'
```

Login:

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"candidate1@example.com","password":"hunter22!"}'
```

Me (replace `<JWT>` with the token from register/login):

```bash
curl http://localhost:8080/auth/me \
  -H "Authorization: Bearer <JWT>"
```

Forgot password (token is logged to stdout in dev — copy from the server log):

```bash
curl -X POST http://localhost:8080/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"candidate1@example.com"}'
```

Reset password (replace `<RESET_TOKEN>` with the value from the dev log):

```bash
curl -X POST http://localhost:8080/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<RESET_TOKEN>","newPassword":"newhunter22!"}'
```

### Roles & RBAC

JWT claims include `roles` (e.g. `["CANDIDATE"]`). On the server they are mapped to Spring authorities as `ROLE_<NAME>` so method-level `@PreAuthorize("hasRole('ADMIN')")` works.

- A bootstrap admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) is created on first startup if no admin exists.
- Verify RBAC with `GET /admin/test` — should return 200 for ADMIN, 403 for everyone else, 401 with no token.

## Notes

- `spring.jpa.hibernate.ddl-auto=update` is fine for early development; switch to Flyway/Liquibase before going live.
- Spring Security is locked down by default — `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/health`, and `/error` are public. Everything else requires a valid JWT.

<!-- deploy-trigger: 2026-05-19 (retry after Railway buildkit daemon crash on cde9b07) -->

