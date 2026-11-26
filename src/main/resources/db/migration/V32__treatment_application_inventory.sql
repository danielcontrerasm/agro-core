ALTER TABLE inspection_treatment ADD COLUMN operation_id UUID;
ALTER TABLE inspection_treatment ADD COLUMN inventory_lot_id BIGINT REFERENCES inventory_lot(id);
ALTER TABLE inspection_treatment ADD COLUMN inventory_lot_code VARCHAR(80);
ALTER TABLE inspection_treatment ADD COLUMN inventory_movement_id BIGINT UNIQUE REFERENCES inventory_movement(id);
ALTER TABLE inspection_treatment ADD COLUMN financial_entry_id BIGINT UNIQUE REFERENCES farm_financial_entry(id);
ALTER TABLE inspection_treatment ADD CONSTRAINT uk_inspection_treatment_operation UNIQUE (inspection_id, operation_id);
ALTER TABLE inspection_treatment ADD CONSTRAINT ck_inspection_treatment_inventory CHECK (
  (inventory_lot_id IS NULL AND inventory_lot_code IS NULL AND inventory_movement_id IS NULL AND financial_entry_id IS NULL)
  OR (inventory_lot_id IS NOT NULL AND inventory_lot_code IS NOT NULL AND inventory_movement_id IS NOT NULL
      AND financial_entry_id IS NOT NULL AND operation_id IS NOT NULL)
);
