ALTER TABLE phytosanitary_inspection ADD COLUMN canceled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE phytosanitary_inspection ADD COLUMN canceled_by_user_id BIGINT REFERENCES app_user(id);
ALTER TABLE phytosanitary_inspection ADD COLUMN cancellation_reason TEXT;
ALTER TABLE phytosanitary_inspection ADD COLUMN parent_inspection_id BIGINT REFERENCES phytosanitary_inspection(id);

CREATE TABLE inspection_treatment (
  id BIGSERIAL PRIMARY KEY,
  inspection_id BIGINT NOT NULL REFERENCES phytosanitary_inspection(id) ON DELETE CASCADE,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT NOT NULL,
  product VARCHAR(250),
  quantity DOUBLE PRECISION CHECK (quantity > 0),
  unit VARCHAR(40),
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((quantity IS NULL AND unit IS NULL) OR (quantity IS NOT NULL AND unit IS NOT NULL))
);

CREATE TABLE inspection_evidence (
  id BIGSERIAL PRIMARY KEY,
  inspection_id BIGINT NOT NULL REFERENCES phytosanitary_inspection(id) ON DELETE CASCADE,
  treatment_id BIGINT REFERENCES inspection_treatment(id),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('IMAGE', 'DOCUMENT', 'VIDEO')),
  s3_key VARCHAR(1024) NOT NULL,
  content_type VARCHAR(150),
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_treatment_inspection ON inspection_treatment(inspection_id, occurred_at);
CREATE INDEX idx_evidence_inspection ON inspection_evidence(inspection_id);
CREATE INDEX idx_inspection_parent ON phytosanitary_inspection(parent_inspection_id);
