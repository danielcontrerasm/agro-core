CREATE TABLE soil_analysis (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  sampled_on DATE NOT NULL,
  details TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  report BYTEA,
  report_type VARCHAR(30)
);
CREATE INDEX idx_soil_analysis_latest ON soil_analysis(block_id, sampled_on DESC, id DESC);
CREATE TABLE fertilization_plan (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  analysis_id BIGINT NOT NULL REFERENCES soil_analysis(id),
  inspection_id BIGINT REFERENCES phytosanitary_inspection(id),
  details TEXT NOT NULL,
  total_quantity NUMERIC(16,6) NOT NULL CHECK(total_quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','CANCELED')),
  version BIGINT NOT NULL DEFAULT 0,
  task_id BIGINT UNIQUE REFERENCES farm_task(id),
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  approved_by BIGINT REFERENCES app_user(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  decision_reason VARCHAR(4000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE fertilization_application (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES fertilization_plan(id),
  event_id BIGINT NOT NULL UNIQUE REFERENCES field_event(id),
  quantity NUMERIC(16,6) NOT NULL CHECK(quantity > 0),
  details TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fertilization_application_plan ON fertilization_application(plan_id);
CREATE TABLE fertilization_followup (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES fertilization_plan(id),
  analysis_id BIGINT REFERENCES soil_analysis(id),
  observations VARCHAR(4000) NOT NULL,
  reviewed_by BIGINT NOT NULL REFERENCES app_user(id),
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
