ALTER TABLE public_approval_tokens
  ADD COLUMN period_key VARCHAR(20) NULL AFTER approval_flow_id,
  ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING' AFTER period_key,
  ADD COLUMN client_note TEXT NULL AFTER status;
