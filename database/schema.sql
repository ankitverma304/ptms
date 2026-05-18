-- ============================================================
--  PTMS — Project & Ticket Management System
--  MySQL 8.x Schema  |  Engine: InnoDB  |  utf8mb4_unicode_ci
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ──────────────────────────────────────────────
--  USERS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150)  NOT NULL,
  email         VARCHAR(200)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('super_admin','admin','project_manager','team_lead','developer','qa') NOT NULL DEFAULT 'developer',
  avatar_url    VARCHAR(500)  NULL,
  total_points  INT           NOT NULL DEFAULT 0,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  last_login    DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  REFRESH TOKENS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255)    NOT NULL UNIQUE,
  expires_at DATETIME        NOT NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  TAGS  (shared across projects & tickets)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80)  NOT NULL UNIQUE,
  color      CHAR(7)      NOT NULL DEFAULT '#6366f1',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  PROJECTS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(200)  NOT NULL,
  code             VARCHAR(20)   NOT NULL UNIQUE,          -- e.g. PRJ-0042
  description      TEXT          NULL,
  client_name      VARCHAR(200)  NULL,
  type             ENUM('fixed_price','time_material','internal','support') NOT NULL DEFAULT 'fixed_price',
  priority         ENUM('critical','high','medium','low')  NOT NULL DEFAULT 'medium',
  status           ENUM('not_started','active','on_hold','completed','archived') NOT NULL DEFAULT 'not_started',
  pm_id            BIGINT UNSIGNED NULL,                   -- project manager
  start_date       DATE          NULL,
  end_date         DATE          NULL,
  expected_days    INT UNSIGNED  NULL,                     -- computed on save
  created_by       BIGINT UNSIGNED NOT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pm_id)        REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)   REFERENCES users(id),
  INDEX idx_projects_status (status),
  INDEX idx_projects_pm (pm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_members (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id       BIGINT UNSIGNED NOT NULL,
  user_id          BIGINT UNSIGNED NOT NULL,
  role_in_project  ENUM('manager','lead','member','qa') NOT NULL DEFAULT 'member',
  joined_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pm_user (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_tags (
  project_id BIGINT UNSIGNED NOT NULL,
  tag_id     BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)     REFERENCES tags(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_attachments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id  BIGINT UNSIGNED NOT NULL,
  file_name   VARCHAR(255)    NOT NULL,
  file_path   VARCHAR(500)    NOT NULL,
  file_size   INT UNSIGNED    NOT NULL,
  mime_type   VARCHAR(100)    NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  TICKETS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      BIGINT UNSIGNED NOT NULL,
  ticket_code     VARCHAR(30)  NOT NULL UNIQUE,            -- TKT-2025-0001
  title           VARCHAR(255) NOT NULL,
  description     LONGTEXT     NULL,
  priority        ENUM('critical','high','medium','low') NOT NULL DEFAULT 'medium',
  status          ENUM('open','in_progress','under_review','testing','resolved','closed') NOT NULL DEFAULT 'open',
  assignee_id     BIGINT UNSIGNED NULL,
  reporter_id     BIGINT UNSIGNED NOT NULL,
  start_date      DATE         NULL,
  due_date        DATE         NULL,
  estimated_hrs   DECIMAL(7,2) NULL,
  actual_hrs      DECIMAL(7,2) NOT NULL DEFAULT 0,         -- updated via trigger / service
  is_bug          BOOLEAN      NOT NULL DEFAULT FALSE,
  bug_severity    ENUM('minor','major','critical') NULL,   -- set when is_bug = true
  closed_at       DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  INDEX idx_tickets_project  (project_id),
  INDEX idx_tickets_assignee (assignee_id),
  INDEX idx_tickets_status   (status),
  INDEX idx_tickets_due      (due_date),
  INDEX idx_tickets_is_bug   (is_bug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ticket tags
CREATE TABLE IF NOT EXISTS ticket_tags (
  ticket_id BIGINT UNSIGNED NOT NULL,
  tag_id    BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (ticket_id, tag_id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)    REFERENCES tags(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ticket attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id   BIGINT UNSIGNED NOT NULL,
  file_name   VARCHAR(255)    NOT NULL,
  file_path   VARCHAR(500)    NOT NULL,
  file_size   INT UNSIGNED    NOT NULL,
  mime_type   VARCHAR(100)    NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id)   REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Checklist items inside a ticket
CREATE TABLE IF NOT EXISTS ticket_checklist (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id   BIGINT UNSIGNED NOT NULL,
  item_text   VARCHAR(500)    NOT NULL,
  is_done     BOOLEAN         NOT NULL DEFAULT FALSE,
  sort_order  SMALLINT        NOT NULL DEFAULT 0,
  created_by  BIGINT UNSIGNED NOT NULL,
  done_at     DATETIME        NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id)  REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ticket dependencies (blocks / blocked-by)
CREATE TABLE IF NOT EXISTS ticket_dependencies (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id       BIGINT UNSIGNED NOT NULL,   -- "this ticket"
  depends_on_id   BIGINT UNSIGNED NOT NULL,   -- "blocks this ticket"
  type            ENUM('blocks','blocked_by') NOT NULL DEFAULT 'blocks',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dep (ticket_id, depends_on_id),
  FOREIGN KEY (ticket_id)     REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ticket watchers
CREATE TABLE IF NOT EXISTS ticket_watchers (
  ticket_id  BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id, user_id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  TICKET HISTORY  (immutable audit trail)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_history (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id     BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NULL,                       -- NULL = system action
  action        VARCHAR(80)     NOT NULL,                   -- e.g. status_changed, assigned, commented
  field_changed VARCHAR(80)     NULL,
  old_value     TEXT            NULL,
  new_value     TEXT            NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_th_ticket (ticket_id),
  INDEX idx_th_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  TIME LOGS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id   BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  hours       DECIMAL(5,2)    NOT NULL,
  work_date   DATE            NOT NULL,
  logged_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note        TEXT            NULL,
  is_billable BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  INDEX idx_tl_ticket  (ticket_id),
  INDEX idx_tl_user    (user_id),
  INDEX idx_tl_date    (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  BUGS  (detailed bug record linked to ticket)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bugs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id    BIGINT UNSIGNED NOT NULL UNIQUE,             -- 1 bug record per ticket
  severity     ENUM('minor','major','critical') NOT NULL,
  reported_by  BIGINT UNSIGNED NOT NULL,
  fix_start    DATETIME        NULL,
  fix_end      DATETIME        NULL,
  fix_minutes  INT UNSIGNED    NULL,                        -- computed: TIMESTAMPDIFF(MINUTE, fix_start, fix_end)
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id)   REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  POINTS LOG  (immutable; one row per event)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_points_log (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id    BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  event_type   ENUM('on_time','overdue','bug_minor','bug_major','bug_critical','manual_adjust') NOT NULL,
  delta        TINYINT         NOT NULL,                    -- +1, -1, -5, -10, or manual
  bug_severity ENUM('minor','major','critical') NULL,
  fix_minutes  INT UNSIGNED    NULL,
  notes        TEXT            NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  INDEX idx_pl_user    (user_id),
  INDEX idx_pl_ticket  (ticket_id),
  INDEX idx_pl_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  COMMENTS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id  BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  body       LONGTEXT        NOT NULL,
  is_edited  BOOLEAN         NOT NULL DEFAULT FALSE,
  deleted_at DATETIME        NULL,                          -- soft delete
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  INDEX idx_comments_ticket (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comment_attachments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  comment_id  BIGINT UNSIGNED NOT NULL,
  file_name   VARCHAR(255)    NOT NULL,
  file_path   VARCHAR(500)    NOT NULL,
  file_size   INT UNSIGNED    NOT NULL,
  mime_type   VARCHAR(100)    NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comment_mentions (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  comment_id BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_mention (comment_id, user_id),
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  NOTIFICATIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  type        VARCHAR(60)     NOT NULL,                     -- assigned, mentioned, status_changed, due_soon, points_updated
  title       VARCHAR(255)    NOT NULL,
  message     TEXT            NULL,
  entity_type VARCHAR(30)     NULL,                         -- ticket | project | comment
  entity_id   BIGINT UNSIGNED NULL,
  is_read     BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user   (user_id),
  INDEX idx_notif_read   (user_id, is_read),
  INDEX idx_notif_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
--  TRIGGERS — keep actual_hrs in sync
-- ──────────────────────────────────────────────
DELIMITER $$

CREATE TRIGGER trg_time_log_insert
AFTER INSERT ON time_logs FOR EACH ROW
BEGIN
  UPDATE tickets SET actual_hrs = (
    SELECT COALESCE(SUM(hours), 0) FROM time_logs WHERE ticket_id = NEW.ticket_id
  ) WHERE id = NEW.ticket_id;
END$$

CREATE TRIGGER trg_time_log_update
AFTER UPDATE ON time_logs FOR EACH ROW
BEGIN
  UPDATE tickets SET actual_hrs = (
    SELECT COALESCE(SUM(hours), 0) FROM time_logs WHERE ticket_id = NEW.ticket_id
  ) WHERE id = NEW.ticket_id;
END$$

CREATE TRIGGER trg_time_log_delete
AFTER DELETE ON time_logs FOR EACH ROW
BEGIN
  UPDATE tickets SET actual_hrs = (
    SELECT COALESCE(SUM(hours), 0) FROM time_logs WHERE ticket_id = OLD.ticket_id
  ) WHERE id = OLD.ticket_id;
END$$

-- Keep users.total_points in sync when points log changes
CREATE TRIGGER trg_points_insert
AFTER INSERT ON ticket_points_log FOR EACH ROW
BEGIN
  UPDATE users SET total_points = (
    SELECT COALESCE(SUM(delta), 0) FROM ticket_points_log WHERE user_id = NEW.user_id
  ) WHERE id = NEW.user_id;
END$$

DELIMITER ;

-- ──────────────────────────────────────────────
--  SEED — Default super admin
-- ──────────────────────────────────────────────
-- Password: Admin@1234  (bcrypt hash, cost 12)
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
('Super Admin', 'admin@ptms.local', '$2b$12$placeholder_replace_with_real_hash', 'super_admin');

SET FOREIGN_KEY_CHECKS = 1;
