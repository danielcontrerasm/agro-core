ALTER TABLE fertilization_application ADD COLUMN operation_id UUID;
ALTER TABLE fertilization_application ADD COLUMN inventory_lot_id BIGINT REFERENCES inventory_lot(id);
ALTER TABLE fertilization_application ADD COLUMN inventory_movement_id BIGINT REFERENCES inventory_movement(id);
ALTER TABLE fertilization_application ADD COLUMN financial_entry_id BIGINT REFERENCES farm_financial_entry(id);
ALTER TABLE fertilization_application ADD CONSTRAINT uq_fertilization_application_operation UNIQUE (plan_id, operation_id);
ALTER TABLE fertilization_application ADD CONSTRAINT uq_fertilization_application_movement UNIQUE (inventory_movement_id);
ALTER TABLE fertilization_application ADD CONSTRAINT uq_fertilization_application_expense UNIQUE (financial_entry_id);
