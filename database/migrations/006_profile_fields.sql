ALTER TABLE users
  ADD COLUMN birthday DATE NULL AFTER phone,
  ADD COLUMN github_username VARCHAR(80) NULL AFTER birthday,
  ADD COLUMN portfolio_url VARCHAR(2048) NULL AFTER github_username;

ALTER TABLE agency_profile
  ADD COLUMN slogan VARCHAR(500) NULL AFTER name,
  ADD COLUMN logo_dark VARCHAR(2048) NULL AFTER logo,
  ADD COLUMN planning_month VARCHAR(20) NULL AFTER timezone,
  ADD COLUMN deadline VARCHAR(40) NULL AFTER planning_month,
  ADD COLUMN deadline_pre VARCHAR(40) NULL AFTER deadline,
  ADD COLUMN deadline_final VARCHAR(40) NULL AFTER deadline_pre,
  ADD COLUMN theme_json JSON NULL AFTER deadline_final;
