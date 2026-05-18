-- ============================================================
-- skyzentech.com Database Schema
-- Import this file via cPanel > phpMyAdmin > Import
-- ============================================================

-- -------------------------------------------------------
-- Table: postings
-- Used by: admin.php, add.php, edit.php, delete.php, postings.php
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `postings` (
  `sl`            INT(11) NOT NULL AUTO_INCREMENT,
  `role`          VARCHAR(255) NOT NULL DEFAULT '',
  `company`       VARCHAR(255) NOT NULL DEFAULT '',
  `location`      VARCHAR(255) NOT NULL DEFAULT '',
  `description`   TEXT NOT NULL,
  `posted`        DATE DEFAULT NULL,
  `last`          DATE DEFAULT NULL,
  `jd`            TEXT DEFAULT NULL,
  `expirience`    VARCHAR(100) DEFAULT NULL,
  `qualification` VARCHAR(255) DEFAULT NULL,
  `salary`        VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`sl`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- -------------------------------------------------------
-- Table: users
-- Used by: admin/index.php (login)
-- Passwords must be stored as PHP password_hash() output
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`       INT(11) NOT NULL AUTO_INCREMENT,
  `name`     VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- Default admin user
-- Username : admin
-- Password : Admin@1234
--
-- To change the password, generate a new hash by running
-- this in any PHP file on your server:
--   echo password_hash('YourNewPassword', PASSWORD_DEFAULT);
-- Then UPDATE users SET password='<new_hash>' WHERE name='admin';
-- -------------------------------------------------------
INSERT INTO `users` (`name`, `password`) VALUES
('admin', '$2y$10$Y9O5p7BTyk6cxSQpMhE4D.0iFgBSw3wGvLPOGDnIHPpJf77vaqGcG');


-- -------------------------------------------------------
-- Table: lca1
-- Used by: admin.php (dashboard count only)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lca1` (
  `id`    INT(11) NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
