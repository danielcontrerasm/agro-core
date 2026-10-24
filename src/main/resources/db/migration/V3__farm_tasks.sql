CREATE TABLE farm_task (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  field_id BIGINT REFERENCES field(id),
  block_id BIGINT REFERENCES block(id),
  assignee_id BIGINT NOT NULL,
  title VARCHAR(150) NOT NULL,
  activity VARCHAR(20) NOT NULL CHECK (activity IN ('fertilization', 'irrigation', 'scouting', 'planting', 'harvest')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('Alta', 'Media', 'Baja')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'progress', 'review', 'completed', 'blocked')),
  instructions VARCHAR(4000) NOT NULL,
  notes VARCHAR(4000),
  version BIGINT NOT NULL DEFAULT 0,
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (farm_id, assignee_id) REFERENCES farm_membership(farm_id, user_id),
  CHECK ((field_id IS NOT NULL AND block_id IS NULL) OR (block_id IS NOT NULL AND field_id IS NULL))
);

CREATE INDEX idx_task_farm_date ON farm_task(farm_id, scheduled_date);
CREATE INDEX idx_task_assignee ON farm_task(assignee_id);
CREATE INDEX idx_task_field ON farm_task(field_id);
CREATE INDEX idx_task_block ON farm_task(block_id);
