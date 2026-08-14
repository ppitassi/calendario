CREATE TABLE rate_limits (
  bucket_key VARCHAR(191) PRIMARY KEY,
  hit_count INT UNSIGNED NOT NULL DEFAULT 1,
  reset_at DATETIME(3) NOT NULL,
  INDEX idx_rate_limits_reset (reset_at)
) ENGINE=InnoDB;

CREATE TABLE integration_connections (
  id CHAR(36) PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  client_id CHAR(36) NULL,
  external_id VARCHAR(255) NULL,
  display_name VARCHAR(255) NULL,
  encrypted_access_token LONGTEXT NULL,
  encrypted_refresh_token LONGTEXT NULL,
  scopes_json JSON NULL,
  metadata_json JSON NULL,
  expires_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_integrations_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_integrations_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_integration_account (provider, client_id, external_id)
) ENGINE=InnoDB;

CREATE TABLE oauth_states (
  state_hash CHAR(64) PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  client_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  verifier_hash CHAR(64) NULL,
  metadata_json JSON NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_oauth_states_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_oauth_states_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE push_subscriptions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  endpoint_hash CHAR(64) NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_secret TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE presentation_snapshots (
  id CHAR(36) PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  period_key VARCHAR(40) NOT NULL,
  snapshot_json JSON NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_presentation_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_presentation_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_presentation_period (client_id, period_key, created_at)
) ENGINE=InnoDB;

CREATE TABLE presentation_pdf_jobs (
  id CHAR(36) PRIMARY KEY,
  snapshot_id CHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  storage_key VARCHAR(1024) NULL,
  error_text TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  CONSTRAINT fk_pdf_jobs_snapshot FOREIGN KEY (snapshot_id) REFERENCES presentation_snapshots(id) ON DELETE CASCADE,
  INDEX idx_pdf_jobs_queue (status, created_at)
) ENGINE=InnoDB;
