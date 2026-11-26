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

-- H2 assigns a different automatic name to the V8 target constraint.
CREATE TABLE photo_asset (
  id VARCHAR(36) PRIMARY KEY,
  event_id BIGINT REFERENCES field_event(id) ON DELETE CASCADE,
  inspection_id BIGINT REFERENCES phytosanitary_inspection(id) ON DELETE CASCADE,
  treatment_id BIGINT REFERENCES inspection_treatment(id),
  original_name VARCHAR(250) NOT NULL,
  content_type VARCHAR(30) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  size_bytes INT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  image_data BYTEA NOT NULL,
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT photo_asset_check CHECK (
    (event_id IS NOT NULL AND inspection_id IS NULL AND treatment_id IS NULL)
    OR (event_id IS NULL AND inspection_id IS NOT NULL)
  )
);
