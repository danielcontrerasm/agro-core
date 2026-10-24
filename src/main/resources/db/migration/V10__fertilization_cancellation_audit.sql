ALTER TABLE fertilization_plan ADD COLUMN canceled_by BIGINT REFERENCES app_user(id);
ALTER TABLE fertilization_plan ADD COLUMN canceled_at TIMESTAMP WITH TIME ZONE;
