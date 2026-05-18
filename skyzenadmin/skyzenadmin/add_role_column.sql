-- Run this SQL in your database (phpMyAdmin or MySQL CLI)
-- Adds a 'role' column to the users table
-- Default role is 'user', and your first/main admin account gets 'admin'

ALTER TABLE users ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'user' AFTER password;

-- Set your main admin account (change 'admin' to your actual admin username)
UPDATE users SET role = 'admin' WHERE id = 1;
