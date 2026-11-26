ALTER TABLE inspection_treatment_followup ADD COLUMN inventory_product_id BIGINT REFERENCES inventory_product(id);

UPDATE inspection_treatment_followup
SET inventory_product_id = (
  SELECT l.product_id FROM inspection_treatment t JOIN inventory_lot l ON l.id = t.inventory_lot_id
  WHERE t.id = inspection_treatment_followup.treatment_id
)
WHERE treatment_id IS NOT NULL;

ALTER TABLE inspection_treatment_followup ADD CHECK (inventory_product_id IS NULL OR product IS NOT NULL);
