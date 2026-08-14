CREATE TABLE publication_jobs (
  id CHAR(36) PRIMARY KEY,
  publication_id CHAR(36) NOT NULL,
  platform VARCHAR(30) NOT NULL,
  scheduled_for DATETIME(3) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3) NOT NULL,
  external_id VARCHAR(255) NULL,
  error TEXT NULL,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_publication_jobs_publication FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
  INDEX idx_publication_jobs_queue (status,next_attempt_at,scheduled_for)
) ENGINE=InnoDB;
