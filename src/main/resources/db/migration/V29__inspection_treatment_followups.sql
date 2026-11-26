CREATE TABLE inspection_treatment_followup (
  id BIGSERIAL PRIMARY KEY,
  inspection_id BIGINT NOT NULL REFERENCES phytosanitary_inspection(id) ON DELETE CASCADE,
  request_id UUID,
  description TEXT NOT NULL,
  product VARCHAR(250),
  authorized_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  authorized_at TIMESTAMP WITH TIME ZONE NOT NULL,
  treatment_id BIGINT UNIQUE REFERENCES inspection_treatment(id),
  product_lot VARCHAR(80),
  verified_by_user_id BIGINT REFERENCES app_user(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  outcome VARCHAR(20) CHECK (outcome IN ('EFFECTIVE', 'PARTIAL', 'INEFFECTIVE')),
  verification_notes TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  UNIQUE (inspection_id, request_id),
  CHECK (treatment_id IS NOT NULL OR product_lot IS NULL),
  CHECK (treatment_id IS NULL OR (product IS NULL AND product_lot IS NULL)
          OR (product IS NOT NULL AND product_lot IS NOT NULL)),
  CHECK ((verified_at IS NULL AND verified_by_user_id IS NULL AND outcome IS NULL AND verification_notes IS NULL)
      OR (treatment_id IS NOT NULL AND verified_at IS NOT NULL AND verified_by_user_id IS NOT NULL
          AND outcome IS NOT NULL AND verification_notes IS NOT NULL))
);
