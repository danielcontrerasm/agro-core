CREATE TABLE irrigation_recurring_schedule (
  id BIGSERIAL PRIMARY KEY,
  sector_id BIGINT NOT NULL REFERENCES irrigation_sector(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  recurrence_unit VARCHAR(10) NOT NULL CHECK (recurrence_unit IN ('DAILY', 'WEEKLY')),
  recurrence_interval INTEGER NOT NULL CHECK (recurrence_interval > 0 AND recurrence_interval <= 365),
  duration_minutes NUMERIC(16,6) NOT NULL CHECK (duration_minutes > 0),
  volume_m3 NUMERIC(16,6) NOT NULL CHECK (volume_m3 > 0),
  assignee_id BIGINT NOT NULL,
  justification VARCHAR(2000) NOT NULL,
  instructions VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELED')),
  version BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  cancel_reason VARCHAR(2000),
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignee_id) REFERENCES app_user(id),
  CHECK (end_date >= start_date)
);

ALTER TABLE irrigation_plan ADD COLUMN recurring_schedule_id BIGINT REFERENCES irrigation_recurring_schedule(id) ON DELETE SET NULL;
ALTER TABLE irrigation_plan ADD COLUMN occurrence_on DATE;
ALTER TABLE irrigation_plan ADD CONSTRAINT irrigation_plan_recurring_occurrence_check
  CHECK ((recurring_schedule_id IS NULL AND occurrence_on IS NULL) OR (recurring_schedule_id IS NOT NULL AND occurrence_on IS NOT NULL));
ALTER TABLE irrigation_plan ADD CONSTRAINT irrigation_plan_recurring_occurrence_unique UNIQUE (recurring_schedule_id, occurrence_on);
CREATE INDEX idx_irrigation_recurring_schedule_sector ON irrigation_recurring_schedule(sector_id, status);
CREATE INDEX idx_irrigation_plan_recurring_schedule ON irrigation_plan(recurring_schedule_id, occurrence_on);

CREATE TABLE irrigation_recurring_schedule_history (
  id BIGSERIAL PRIMARY KEY,
  schedule_id BIGINT NOT NULL REFERENCES irrigation_recurring_schedule(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'PAUSED', 'RESUMED', 'CANCELED', 'GENERATED')),
  details TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_irrigation_recurring_history_schedule ON irrigation_recurring_schedule_history(schedule_id, created_at DESC, id DESC);
