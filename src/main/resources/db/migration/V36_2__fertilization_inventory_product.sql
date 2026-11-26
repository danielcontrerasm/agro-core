ALTER TABLE fertilization_plan ADD COLUMN inventory_product_id BIGINT REFERENCES inventory_product(id);

UPDATE fertilization_plan
SET inventory_product_id = (
  SELECT MIN(l.product_id)
  FROM fertilization_application a JOIN inventory_lot l ON l.id = a.inventory_lot_id
  WHERE a.plan_id = fertilization_plan.id
  GROUP BY a.plan_id
  HAVING COUNT(DISTINCT l.product_id) = 1
);
