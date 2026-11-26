CREATE TABLE workforce_crew (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  name_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  UNIQUE (farm_id, name_key),
  UNIQUE (farm_id, id)
);

CREATE TABLE workforce_crew_member (
  farm_id BIGINT NOT NULL,
  crew_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  PRIMARY KEY (farm_id, user_id),
  FOREIGN KEY (farm_id, crew_id) REFERENCES workforce_crew(farm_id, id) ON DELETE CASCADE,
  FOREIGN KEY (farm_id, user_id) REFERENCES farm_membership(farm_id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_workforce_crew_member_crew ON workforce_crew_member(crew_id);

CREATE TABLE workforce_attendance (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES app_user(id),
  attendance_date DATE NOT NULL,
  status VARCHAR(12) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'EXCUSED')),
  hours NUMERIC(4,2) NOT NULL CHECK (hours BETWEEN 0 AND 24),
  notes VARCHAR(500),
  version INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (farm_id, attendance_date, user_id),
  CHECK ((status = 'PRESENT' AND hours > 0) OR (status <> 'PRESENT' AND hours = 0))
);
