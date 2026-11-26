CREATE TABLE inventory_product (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  minimum NUMERIC(16,3) NOT NULL CHECK (minimum >= 0),
  UNIQUE (farm_id, id),
  UNIQUE (farm_id, code)
);

CREATE TABLE inventory_lot (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  code VARCHAR(80) NOT NULL,
  expires_on DATE,
  balance NUMERIC(16,3) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  FOREIGN KEY (farm_id, product_id) REFERENCES inventory_product(farm_id, id) ON DELETE CASCADE,
  UNIQUE (farm_id, id),
  UNIQUE (product_id, code)
);

CREATE INDEX idx_inventory_lot_farm_product ON inventory_lot (farm_id, product_id);

CREATE TABLE inventory_movement (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL,
  lot_id BIGINT NOT NULL,
  request_id UUID NOT NULL,
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('IN', 'OUT')),
  quantity NUMERIC(16,3) NOT NULL CHECK (quantity > 0),
  balance_after NUMERIC(16,3) NOT NULL CHECK (balance_after >= 0),
  reference_label VARCHAR(180),
  notes VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  FOREIGN KEY (farm_id, lot_id) REFERENCES inventory_lot(farm_id, id) ON DELETE CASCADE,
  UNIQUE (farm_id, request_id)
);

CREATE INDEX idx_inventory_movement_farm ON inventory_movement (farm_id, id DESC);
CREATE INDEX idx_inventory_movement_lot ON inventory_movement (farm_id, lot_id);
