CREATE TABLE farm_financial_entry (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  field_id BIGINT REFERENCES field(id) ON DELETE SET NULL,
  block_id BIGINT REFERENCES block(id) ON DELETE SET NULL,
  operation_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  entry_type VARCHAR(10) NOT NULL,
  category VARCHAR(30) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  description VARCHAR(300) NOT NULL CHECK (TRIM(description) <> ''),
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  updated_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version BIGINT NOT NULL DEFAULT 0,
  UNIQUE (farm_id, operation_id),
  CHECK ((entry_type = 'EXPENSE' AND category IN ('FERTILIZERS', 'PHYTOSANITARY', 'LABOR', 'IRRIGATION_ENERGY', 'MAINTENANCE', 'OTHER_EXPENSE'))
      OR (entry_type = 'INCOME' AND category IN ('CROP_SALE', 'OTHER_INCOME')))
);

CREATE INDEX idx_farm_financial_entry_period ON farm_financial_entry(farm_id, entry_date DESC, id DESC);

CREATE TABLE farm_monthly_budget (
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  period_start DATE NOT NULL CHECK (EXTRACT(DAY FROM period_start) = 1),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  updated_by BIGINT NOT NULL REFERENCES app_user(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (farm_id, period_start)
);
