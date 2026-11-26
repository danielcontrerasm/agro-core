CREATE FUNCTION guard_accounted_inspection_treatment_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE foreign_key_violation USING
    MESSAGE = 'delete on table "inspection_treatment" violates foreign key constraint "accounted_treatment_delete_guard"',
    CONSTRAINT = 'accounted_treatment_delete_guard';
END;
$$;

-- An accounting source must survive even when a location is deleted through a cascade.
CREATE TRIGGER accounted_treatment_delete_guard
BEFORE DELETE ON inspection_treatment
FOR EACH ROW
WHEN (OLD.financial_entry_id IS NOT NULL)
EXECUTE FUNCTION guard_accounted_inspection_treatment_delete();
