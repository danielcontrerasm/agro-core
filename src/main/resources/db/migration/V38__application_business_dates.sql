WITH application_dates AS (
  SELECT a.inventory_movement_id, a.financial_entry_id,
    CAST(e.occurred_at AT TIME ZONE 'America/Bogota' AS DATE) AS applied_on
  FROM fertilization_application a
  JOIN field_event e ON e.id = a.event_id
  JOIN farm_financial_entry expense ON expense.id = a.financial_entry_id
    AND expense.source_type = 'FERTILIZATION_APPLICATION' AND expense.source_id = a.id
  UNION ALL
  SELECT t.inventory_movement_id, t.financial_entry_id,
    CAST(t.occurred_at AT TIME ZONE 'America/Bogota' AS DATE) AS applied_on
  FROM inspection_treatment t
  JOIN farm_financial_entry expense ON expense.id = t.financial_entry_id
    AND expense.source_type = 'PHYTOSANITARY_TREATMENT' AND expense.source_id = t.id
), moved AS (
  UPDATE inventory_movement movement
  SET applied_on = application.applied_on
  FROM application_dates application
  WHERE movement.id = application.inventory_movement_id
    AND movement.applied_on <> application.applied_on
)
UPDATE farm_financial_entry expense
SET entry_date = application.applied_on
FROM application_dates application
WHERE expense.id = application.financial_entry_id
  AND expense.entry_date <> application.applied_on;
