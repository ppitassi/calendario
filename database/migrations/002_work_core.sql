CREATE TABLE work_items (
  id CHAR(36) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  client_id CHAR(36) NULL,
  parent_id CHAR(36) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'TODO',
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  progress_strategy VARCHAR(30) NOT NULL DEFAULT 'CHILDREN_AVERAGE',
  progress_weight DECIMAL(10,2) NOT NULL DEFAULT 1,
  created_by CHAR(36) NOT NULL,
  start_at DATETIME(3) NULL,
  due_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  recurrence_rule_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  CONSTRAINT fk_work_items_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_work_items_parent FOREIGN KEY (parent_id) REFERENCES work_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_work_items_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_work_item_type CHECK (type IN ('PROJECT','DEMAND','TASK')),
  CONSTRAINT chk_work_item_status CHECK (status IN ('TODO','IN_PROGRESS','BLOCKED','REVIEW','DONE','CANCELLED')),
  CONSTRAINT chk_work_item_priority CHECK (priority IN ('LOW','NORMAL','HIGH','CRITICAL')),
  CONSTRAINT chk_work_item_progress CHECK (progress >= 0 AND progress <= 100),
  INDEX idx_work_items_parent (parent_id, archived_at, deleted_at),
  INDEX idx_work_items_client (client_id, status, due_at),
  INDEX idx_work_items_assessment (status, priority, due_at)
) ENGINE=InnoDB;

CREATE TABLE work_item_assignees (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(120) NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_by CHAR(36) NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  removed_at DATETIME(3) NULL,
  CONSTRAINT fk_assignees_item FOREIGN KEY (work_item_id) REFERENCES work_items(id),
  CONSTRAINT fk_assignees_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_assignees_actor FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_assignees_active (work_item_id, removed_at),
  INDEX idx_assignees_workload (user_id, removed_at)
) ENGINE=InnoDB;

CREATE TABLE work_item_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NULL,
  event_type VARCHAR(100) NOT NULL,
  data_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_item_events_item FOREIGN KEY (work_item_id) REFERENCES work_items(id),
  CONSTRAINT fk_item_events_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_item_events_timeline (work_item_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE work_item_dependencies (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL,
  depends_on_work_item_id CHAR(36) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'BLOCKED_BY',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_dependencies_item FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_dependencies_parent FOREIGN KEY (depends_on_work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  CONSTRAINT chk_dependency_self CHECK (work_item_id <> depends_on_work_item_id),
  UNIQUE KEY uq_work_dependency (work_item_id, depends_on_work_item_id, type)
) ENGINE=InnoDB;

CREATE TABLE work_item_time_entries (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NULL,
  duration_seconds INT UNSIGNED NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_time_entries_item FOREIGN KEY (work_item_id) REFERENCES work_items(id),
  CONSTRAINT fk_time_entries_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_time_range CHECK (ended_at IS NULL OR ended_at >= started_at),
  INDEX idx_time_entries_reporting (user_id, started_at),
  INDEX idx_time_entries_item (work_item_id, started_at)
) ENGINE=InnoDB;

CREATE TABLE comments (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  parent_comment_id CHAR(36) NULL,
  body TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  CONSTRAINT fk_comments_item FOREIGN KEY (work_item_id) REFERENCES work_items(id),
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE SET NULL,
  INDEX idx_comments_item (work_item_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE comment_mentions (
  comment_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  PRIMARY KEY (comment_id, user_id),
  CONSTRAINT fk_mentions_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT fk_mentions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tags (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE work_item_tags (
  work_item_id CHAR(36) NOT NULL,
  tag_id CHAR(36) NOT NULL,
  PRIMARY KEY (work_item_id, tag_id),
  CONSTRAINT fk_item_tags_item FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE work_item_checklists (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(60) NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  required BOOLEAN NOT NULL DEFAULT FALSE,
  blocking BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to CHAR(36) NULL,
  completed_by CHAR(36) NULL,
  completed_at DATETIME(3) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_checklists_item FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_checklists_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_checklists_completer FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_checklists_item (work_item_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE workflow_templates (
  id CHAR(36) PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE workflow_stages (
  id CHAR(36) PRIMARY KEY,
  workflow_template_id CHAR(36) NOT NULL,
  key_name VARCHAR(100) NOT NULL,
  name VARCHAR(160) NOT NULL,
  maps_to_status VARCHAR(30) NOT NULL,
  sort_order INT NOT NULL,
  terminal BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_workflow_stages_template FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
  UNIQUE KEY uq_workflow_stage (workflow_template_id, key_name)
) ENGINE=InnoDB;

CREATE TABLE workflow_transitions (
  id CHAR(36) PRIMARY KEY,
  workflow_template_id CHAR(36) NOT NULL,
  from_stage_id CHAR(36) NOT NULL,
  to_stage_id CHAR(36) NOT NULL,
  required_permission VARCHAR(100) NULL,
  CONSTRAINT fk_transitions_template FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_transitions_from FOREIGN KEY (from_stage_id) REFERENCES workflow_stages(id) ON DELETE CASCADE,
  CONSTRAINT fk_transitions_to FOREIGN KEY (to_stage_id) REFERENCES workflow_stages(id) ON DELETE CASCADE,
  UNIQUE KEY uq_workflow_transition (from_stage_id, to_stage_id)
) ENGINE=InnoDB;

CREATE TABLE work_item_workflows (
  work_item_id CHAR(36) PRIMARY KEY,
  workflow_template_id CHAR(36) NOT NULL,
  current_stage_id CHAR(36) NOT NULL,
  entered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_item_workflows_item FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_workflows_template FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id),
  CONSTRAINT fk_item_workflows_stage FOREIGN KEY (current_stage_id) REFERENCES workflow_stages(id)
) ENGINE=InnoDB;
