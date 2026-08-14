CREATE TABLE photo_jobs (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL UNIQUE,
  captured_count INT UNSIGNED NOT NULL DEFAULT 0,
  selected_count INT UNSIGNED NOT NULL DEFAULT 0,
  target_edit_count INT UNSIGNED NOT NULL DEFAULT 0,
  edited_count INT UNSIGNED NOT NULL DEFAULT 0,
  exported_count INT UNSIGNED NOT NULL DEFAULT 0,
  delivered_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_photo_jobs_work FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE external_operations (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL UNIQUE,
  operation_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  objective TEXT NULL,
  briefing LONGTEXT NULL,
  location_name VARCHAR(255) NULL,
  address TEXT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  geofence_radius_meters INT UNSIGNED NULL,
  scheduled_start DATETIME(3) NULL,
  scheduled_end DATETIME(3) NULL,
  actual_start DATETIME(3) NULL,
  actual_end DATETIME(3) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PLANNED',
  tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  tracking_started_at DATETIME(3) NULL,
  tracking_ended_at DATETIME(3) NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_external_work FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_external_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_external_type CHECK (operation_type IN ('CAPTURE','MEETING','CLIENT_VISIT','EVENT_COVERAGE','DELIVERY','PICKUP','OTHER')),
  CONSTRAINT chk_external_work_type CHECK (status IN ('PLANNED','READY','DEPARTED','IN_TRANSIT','ARRIVED','IN_PROGRESS','RETURNING','FINISHED','CANCELLED')),
  INDEX idx_external_schedule (status, scheduled_start)
) ENGINE=InnoDB;

CREATE TABLE external_operation_members (
  id CHAR(36) PRIMARY KEY,
  external_operation_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(120) NULL,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  removed_at DATETIME(3) NULL,
  CONSTRAINT fk_external_members_operation FOREIGN KEY (external_operation_id) REFERENCES external_operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_external_members_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_external_members_active (external_operation_id, removed_at)
) ENGINE=InnoDB;

CREATE TABLE external_operation_plan_items (
  id CHAR(36) PRIMARY KEY,
  external_operation_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  required BOOLEAN NOT NULL DEFAULT FALSE,
  blocking BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to CHAR(36) NULL,
  category VARCHAR(40) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  completed_by CHAR(36) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_external_plan_operation FOREIGN KEY (external_operation_id) REFERENCES external_operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_external_plan_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_external_plan_completer FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_external_plan_priority CHECK (priority IN ('LOW','NORMAL','HIGH','CRITICAL')),
  CONSTRAINT chk_external_plan_category CHECK (category IN ('PRE_DEPARTURE','ON_SITE','POST_OPERATION','GENERAL')),
  INDEX idx_external_plan_order (external_operation_id, category, sort_order)
) ENGINE=InnoDB;

CREATE TABLE external_operation_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  external_operation_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NULL,
  event_type VARCHAR(100) NOT NULL,
  data_json JSON NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_external_events_operation FOREIGN KEY (external_operation_id) REFERENCES external_operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_external_events_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_external_events_timeline (external_operation_id, occurred_at)
) ENGINE=InnoDB;

CREATE TABLE external_operation_locations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  external_operation_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_meters DECIMAL(10,2) NULL,
  captured_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_external_locations_operation FOREIGN KEY (external_operation_id) REFERENCES external_operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_external_locations_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_external_locations_track (external_operation_id, captured_at)
) ENGINE=InnoDB;

CREATE TABLE external_operation_incidents (
  id CHAR(36) PRIMARY KEY,
  external_operation_id CHAR(36) NOT NULL,
  reported_by CHAR(36) NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  resolved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_external_incidents_operation FOREIGN KEY (external_operation_id) REFERENCES external_operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_external_incidents_reporter FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE work_item_templates (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  work_item_type VARCHAR(20) NOT NULL,
  template_json JSON NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_work_templates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE checklist_templates (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  items_json JSON NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE external_operation_templates (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  template_json JSON NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE recurrence_definitions (
  id CHAR(36) PRIMARY KEY,
  work_item_template_id CHAR(36) NOT NULL,
  rule_json JSON NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Sao_Paulo',
  next_run_at DATETIME(3) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_recurrence_template FOREIGN KEY (work_item_template_id) REFERENCES work_item_templates(id) ON DELETE CASCADE,
  INDEX idx_recurrence_next (active, next_run_at)
) ENGINE=InnoDB;
