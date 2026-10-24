CREATE TABLE app_user (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE farm_membership (
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'SUPERVISOR', 'WORKER')),
  PRIMARY KEY (farm_id, user_id)
);

CREATE INDEX idx_membership_user ON farm_membership(user_id);
