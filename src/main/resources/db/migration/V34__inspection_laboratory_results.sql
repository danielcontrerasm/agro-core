CREATE TABLE inspection_laboratory_result (
  id BIGSERIAL PRIMARY KEY,
  inspection_id BIGINT NOT NULL REFERENCES phytosanitary_inspection(id) ON DELETE CASCADE,
  request_id UUID,
  sample_reference VARCHAR(120) NOT NULL,
  laboratory VARCHAR(200) NOT NULL,
  sampled_on DATE NOT NULL,
  result_on DATE NOT NULL CHECK (result_on >= sampled_on),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('CONFIRMED', 'NOT_DETECTED', 'INCONCLUSIVE')),
  notes TEXT,
  report_reference VARCHAR(1024),
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (inspection_id, request_id)
);

CREATE INDEX idx_inspection_laboratory_result_date
  ON inspection_laboratory_result (inspection_id, result_on DESC, id DESC);
