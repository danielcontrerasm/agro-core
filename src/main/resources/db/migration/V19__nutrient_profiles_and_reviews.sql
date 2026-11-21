CREATE TABLE nutrient_reference_profile (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  crop VARCHAR(100) NOT NULL,
  variety VARCHAR(100),
  sample_type VARCHAR(20) NOT NULL CHECK(sample_type IN ('SOIL','FOLIAR')),
  version VARCHAR(50) NOT NULL,
  source VARCHAR(1000) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nutrient_profile_lookup
  ON nutrient_reference_profile(farm_id, crop, variety, sample_type, active, id DESC);

CREATE TABLE nutrient_reference_range (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES nutrient_reference_profile(id) ON DELETE CASCADE,
  nutrient VARCHAR(10) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  lower_bound NUMERIC(16,6) NOT NULL CHECK(lower_bound >= 0),
  upper_bound NUMERIC(16,6) NOT NULL CHECK(upper_bound > lower_bound),
  UNIQUE(profile_id, nutrient)
);

CREATE TABLE nutrient_analysis_review (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL UNIQUE REFERENCES soil_analysis(id) ON DELETE CASCADE,
  decision VARCHAR(30) NOT NULL CHECK(decision IN ('CONFIRMED','REQUIRES_FOLLOWUP','REJECTED')),
  notes VARCHAR(4000) NOT NULL,
  reviewed_by BIGINT NOT NULL REFERENCES app_user(id),
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
