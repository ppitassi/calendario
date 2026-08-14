CREATE TABLE social_channels (
  id CHAR(36) PRIMARY KEY,
  key_name VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE content_formats (
  id CHAR(36) PRIMARY KEY,
  key_name VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE content_items (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL UNIQUE,
  head TEXT NULL,
  subhead TEXT NULL,
  caption LONGTEXT NULL,
  objective TEXT NULL,
  hashtags TEXT NULL,
  internal_notes LONGTEXT NULL,
  funnel_stage VARCHAR(40) NULL,
  channel_id CHAR(36) NULL,
  format_id CHAR(36) NULL,
  editorial_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_content_item_work FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_channel FOREIGN KEY (channel_id) REFERENCES social_channels(id) ON DELETE SET NULL,
  CONSTRAINT fk_content_format FOREIGN KEY (format_id) REFERENCES content_formats(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE content_versions (
  id CHAR(36) PRIMARY KEY,
  content_item_id CHAR(36) NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  snapshot_json JSON NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_content_versions_item FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_versions_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_content_version (content_item_id, version_number)
) ENGINE=InnoDB;

CREATE TABLE publications (
  id CHAR(36) PRIMARY KEY,
  content_item_id CHAR(36) NOT NULL,
  channel_id CHAR(36) NOT NULL,
  scheduled_at DATETIME(3) NULL,
  published_at DATETIME(3) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  external_post_id VARCHAR(255) NULL,
  url VARCHAR(2048) NULL,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  verified_by CHAR(36) NULL,
  verified_at DATETIME(3) NULL,
  verification_notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_publications_content FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_publications_channel FOREIGN KEY (channel_id) REFERENCES social_channels(id),
  CONSTRAINT fk_publications_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_publications_schedule (status, scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE approval_flows (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL,
  content_version_id CHAR(36) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  CONSTRAINT fk_approval_flows_work FOREIGN KEY (work_item_id) REFERENCES work_items(id),
  CONSTRAINT fk_approval_flows_version FOREIGN KEY (content_version_id) REFERENCES content_versions(id) ON DELETE SET NULL,
  CONSTRAINT fk_approval_flows_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE approval_steps (
  id CHAR(36) PRIMARY KEY,
  approval_flow_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  approver_user_id CHAR(36) NULL,
  approver_role_id CHAR(36) NULL,
  sort_order INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  CONSTRAINT fk_approval_steps_flow FOREIGN KEY (approval_flow_id) REFERENCES approval_flows(id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_steps_user FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_approval_steps_role FOREIGN KEY (approver_role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE approval_decisions (
  id CHAR(36) PRIMARY KEY,
  approval_step_id CHAR(36) NOT NULL,
  decided_by CHAR(36) NULL,
  decision VARCHAR(30) NOT NULL,
  comment TEXT NULL,
  content_version_id CHAR(36) NULL,
  decided_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_approval_decisions_step FOREIGN KEY (approval_step_id) REFERENCES approval_steps(id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_decisions_user FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_approval_decisions_version FOREIGN KEY (content_version_id) REFERENCES content_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE public_approval_tokens (
  id CHAR(36) PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  client_id CHAR(36) NOT NULL,
  work_item_id CHAR(36) NOT NULL,
  content_version_id CHAR(36) NULL,
  approval_flow_id CHAR(36) NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_public_token_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_public_token_work FOREIGN KEY (work_item_id) REFERENCES work_items(id),
  CONSTRAINT fk_public_token_version FOREIGN KEY (content_version_id) REFERENCES content_versions(id) ON DELETE SET NULL,
  CONSTRAINT fk_public_token_flow FOREIGN KEY (approval_flow_id) REFERENCES approval_flows(id) ON DELETE SET NULL,
  CONSTRAINT fk_public_token_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_public_token_access (token_hash, expires_at, revoked_at)
) ENGINE=InnoDB;

CREATE TABLE media_assets (
  id CHAR(36) PRIMARY KEY,
  storage_provider VARCHAR(40) NOT NULL,
  storage_key VARCHAR(1024) NOT NULL,
  original_name VARCHAR(512) NOT NULL,
  mime_type VARCHAR(191) NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  CONSTRAINT fk_media_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_media_storage (storage_provider, storage_key(191))
) ENGINE=InnoDB;

CREATE TABLE asset_versions (
  id CHAR(36) PRIMARY KEY,
  logical_asset_id CHAR(36) NOT NULL,
  media_asset_id CHAR(36) NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_asset_versions_media FOREIGN KEY (media_asset_id) REFERENCES media_assets(id),
  CONSTRAINT fk_asset_versions_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_asset_version (logical_asset_id, version_number)
) ENGINE=InnoDB;

CREATE TABLE work_item_assets (
  id CHAR(36) PRIMARY KEY,
  work_item_id CHAR(36) NOT NULL,
  media_asset_id CHAR(36) NOT NULL,
  content_version_id CHAR(36) NULL,
  category VARCHAR(80) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_work_assets_work FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_work_assets_media FOREIGN KEY (media_asset_id) REFERENCES media_assets(id),
  CONSTRAINT fk_work_assets_content_version FOREIGN KEY (content_version_id) REFERENCES content_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE public_token_assets (
  public_token_id CHAR(36) NOT NULL,
  asset_version_id CHAR(36) NOT NULL,
  PRIMARY KEY (public_token_id, asset_version_id),
  CONSTRAINT fk_token_assets_token FOREIGN KEY (public_token_id) REFERENCES public_approval_tokens(id) ON DELETE CASCADE,
  CONSTRAINT fk_token_assets_version FOREIGN KEY (asset_version_id) REFERENCES asset_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  recipient_user_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  type VARCHAR(100) NOT NULL,
  work_item_id CHAR(36) NULL,
  data_json JSON NULL,
  deduplication_key VARCHAR(191) NULL UNIQUE,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_work FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  INDEX idx_notifications_inbox (recipient_user_id, read_at, created_at)
) ENGINE=InnoDB;

CREATE TABLE notification_preferences (
  user_id CHAR(36) NOT NULL,
  notification_type VARCHAR(100) NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, notification_type),
  CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notification_outbox (
  id CHAR(36) PRIMARY KEY,
  notification_id CHAR(36) NOT NULL,
  channel VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  last_error TEXT NULL,
  CONSTRAINT fk_notification_outbox_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  UNIQUE KEY uq_notification_channel (notification_id, channel),
  INDEX idx_notification_outbox_queue (status, available_at)
) ENGINE=InnoDB;
