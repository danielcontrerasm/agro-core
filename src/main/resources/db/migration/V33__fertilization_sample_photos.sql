ALTER TABLE photo_asset
  ADD COLUMN analysis_id BIGINT REFERENCES soil_analysis(id) ON DELETE CASCADE;

ALTER TABLE photo_asset DROP CONSTRAINT photo_asset_check;

ALTER TABLE photo_asset ADD CONSTRAINT photo_asset_target_check CHECK (
  (event_id IS NOT NULL AND inspection_id IS NULL AND treatment_id IS NULL AND analysis_id IS NULL)
  OR (event_id IS NULL AND inspection_id IS NOT NULL AND analysis_id IS NULL)
  OR (event_id IS NULL AND inspection_id IS NULL AND treatment_id IS NULL AND analysis_id IS NOT NULL)
);

CREATE INDEX idx_photo_analysis ON photo_asset(analysis_id);
