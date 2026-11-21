CREATE TABLE fertilizer_product (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  composition VARCHAR(1000) NOT NULL,
  default_dose_unit VARCHAR(20) NOT NULL CHECK(default_dose_unit IN ('KG_HA','G_PLANT','L_HA','ML_PLANT')),
  notes VARCHAR(4000),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(farm_id, code)
);

CREATE INDEX idx_fertilizer_product_farm ON fertilizer_product(farm_id, active, name);

ALTER TABLE fertilization_plan ADD COLUMN product_id BIGINT REFERENCES fertilizer_product(id);
ALTER TABLE fertilization_plan ADD COLUMN recurrence VARCHAR(20) NOT NULL DEFAULT 'NONE'
  CHECK(recurrence IN ('NONE','WEEKLY','BIWEEKLY','MONTHLY'));
ALTER TABLE fertilization_plan ADD COLUMN recurrence_until DATE;

CREATE TABLE fertilization_plan_task (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES fertilization_plan(id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL UNIQUE REFERENCES farm_task(id) ON DELETE CASCADE,
  occurrence_on DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, occurrence_on)
);

ALTER TABLE fertilization_application ADD COLUMN task_id BIGINT REFERENCES farm_task(id);

CREATE INDEX idx_fertilization_application_task ON fertilization_application(task_id);
