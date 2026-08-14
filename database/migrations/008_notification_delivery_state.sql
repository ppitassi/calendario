ALTER TABLE notifications
  ADD COLUMN toast_presented_at DATETIME(3) NULL AFTER read_at,
  ADD COLUMN dismissed_at DATETIME(3) NULL AFTER toast_presented_at;

ALTER TABLE push_subscriptions
  ADD COLUMN user_agent VARCHAR(500) NULL AFTER auth_secret;
