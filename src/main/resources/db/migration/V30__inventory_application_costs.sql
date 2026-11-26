ALTER TABLE inventory_product ALTER COLUMN minimum TYPE NUMERIC(19,6);
ALTER TABLE inventory_lot ALTER COLUMN balance TYPE NUMERIC(19,6);
ALTER TABLE inventory_lot ADD COLUMN unit_cost_cop NUMERIC(14,2) CHECK (unit_cost_cop >= 0);

ALTER TABLE inventory_movement ALTER COLUMN quantity TYPE NUMERIC(19,6);
ALTER TABLE inventory_movement ALTER COLUMN balance_after TYPE NUMERIC(19,6);
ALTER TABLE inventory_movement ADD COLUMN applied_on DATE;
ALTER TABLE inventory_movement ADD COLUMN unit_cost_cop NUMERIC(14,2);
ALTER TABLE inventory_movement ADD COLUMN cost_cop NUMERIC(14,2);
ALTER TABLE inventory_movement ADD CONSTRAINT inventory_movement_application_cost_check CHECK (
  (applied_on IS NULL AND unit_cost_cop IS NULL AND cost_cop IS NULL)
  OR (applied_on IS NOT NULL AND direction = 'OUT' AND unit_cost_cop IS NOT NULL AND cost_cop IS NOT NULL
    AND unit_cost_cop >= 0 AND cost_cop >= 0)
);

ALTER TABLE farm_financial_entry ADD COLUMN source_type VARCHAR(30);
ALTER TABLE farm_financial_entry ADD COLUMN source_id BIGINT;
ALTER TABLE farm_financial_entry DROP CONSTRAINT IF EXISTS farm_financial_entry_amount_check;
ALTER TABLE farm_financial_entry ADD CONSTRAINT farm_financial_entry_source_check CHECK (
  (source_type IS NULL AND source_id IS NULL AND amount > 0)
  OR (source_type IS NOT NULL AND source_id IS NOT NULL AND source_id > 0 AND entry_type = 'EXPENSE' AND amount >= 0
    AND ((source_type = 'FERTILIZATION_APPLICATION' AND category = 'FERTILIZERS')
      OR (source_type = 'PHYTOSANITARY_TREATMENT' AND category = 'PHYTOSANITARY')))
);
ALTER TABLE farm_financial_entry ADD CONSTRAINT farm_financial_entry_unique_source UNIQUE (farm_id, source_type, source_id);
