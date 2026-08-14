ALTER TABLE work_items
  ADD COLUMN origin_work_item_id CHAR(36) NULL AFTER parent_id,
  ADD COLUMN origin_external_operation_id CHAR(36) NULL AFTER origin_work_item_id,
  ADD CONSTRAINT fk_work_origin_item FOREIGN KEY (origin_work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;

ALTER TABLE external_operations DROP CONSTRAINT chk_external_work_type;
UPDATE external_operations SET status='PLANNING' WHERE status='PLANNED';
UPDATE external_operations SET status='COMPLETED' WHERE status='FINISHED';
ALTER TABLE external_operations
  ALTER COLUMN status SET DEFAULT 'PLANNING',
  ADD COLUMN final_notes TEXT NULL AFTER tracking_ended_at,
  ADD CONSTRAINT chk_external_status CHECK (status IN ('PLANNING','READY','DEPARTED','IN_TRANSIT','ARRIVED','IN_PROGRESS','FINISHING','RETURNING','COMPLETED','CANCELLED'));

ALTER TABLE work_items
  ADD CONSTRAINT fk_work_origin_external FOREIGN KEY (origin_external_operation_id) REFERENCES external_operations(id) ON DELETE SET NULL;

ALTER TABLE external_operation_members CHANGE COLUMN is_lead is_primary BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE external_operation_events
  ADD COLUMN latitude DECIMAL(10,7) NULL AFTER event_type,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude,
  ADD COLUMN metadata_json JSON NULL AFTER longitude;
ALTER TABLE external_operation_incidents
  ADD COLUMN incident_type VARCHAR(60) NOT NULL DEFAULT 'OTHER' AFTER reported_by,
  ADD CONSTRAINT chk_external_incident_type CHECK (incident_type IN ('CLIENT_DELAY','CLIENT_ABSENT','BRIEFING_CHANGE','TECHNICAL_PROBLEM','EQUIPMENT_PROBLEM','LOCATION_PROBLEM','EXTRA_REQUEST','OTHER'));

CREATE TABLE file_links (
  id CHAR(36) PRIMARY KEY,
  media_asset_id CHAR(36) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  category VARCHAR(80) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_file_links_media FOREIGN KEY (media_asset_id) REFERENCES media_assets(id),
  UNIQUE KEY uq_file_link (media_asset_id,entity_type,entity_id),
  INDEX idx_file_links_entity (entity_type,entity_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO file_links(id,media_asset_id,entity_type,entity_id,category)
SELECT id,media_asset_id,'WORK_ITEM',work_item_id,category FROM work_item_assets;
