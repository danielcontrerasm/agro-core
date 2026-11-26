CREATE TABLE phytosanitary_monitoring_plan (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  problem_code VARCHAR(40) NOT NULL REFERENCES phytosanitary_problem(code),
  start_date DATE NOT NULL,
  interval_days INTEGER NOT NULL CHECK (interval_days BETWEEN 1 AND 365),
  incidence_threshold_percent DOUBLE PRECISION CHECK (incidence_threshold_percent BETWEEN 0 AND 100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version BIGINT NOT NULL DEFAULT 0,
  UNIQUE (block_id, problem_code)
);

CREATE TABLE phytosanitary_monitoring_alert (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES phytosanitary_monitoring_plan(id) ON DELETE CASCADE,
  inspection_id BIGINT NOT NULL REFERENCES phytosanitary_inspection(id) ON DELETE CASCADE,
  incidence_percent DOUBLE PRECISION NOT NULL CHECK (incidence_percent BETWEEN 0 AND 100),
  threshold_percent DOUBLE PRECISION NOT NULL CHECK (threshold_percent BETWEEN 0 AND 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by_user_id BIGINT REFERENCES app_user(id),
  review_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  version BIGINT NOT NULL DEFAULT 0,
  UNIQUE (plan_id, inspection_id)
);

CREATE INDEX idx_phytosanitary_monitoring_alert_plan_time
  ON phytosanitary_monitoring_alert(plan_id, created_at DESC);
