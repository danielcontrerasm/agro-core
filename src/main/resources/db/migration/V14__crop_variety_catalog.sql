CREATE TABLE crop_catalog (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (farm_id, code)
);

CREATE INDEX idx_crop_catalog_farm ON crop_catalog(farm_id, active, name);

CREATE TABLE crop_variety (
  id BIGSERIAL PRIMARY KEY,
  crop_id BIGINT NOT NULL REFERENCES crop_catalog(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (crop_id, code)
);

CREATE INDEX idx_crop_variety_crop ON crop_variety(crop_id, active, name);

ALTER TABLE block ADD COLUMN crop_catalog_id BIGINT REFERENCES crop_catalog(id);
ALTER TABLE block ADD COLUMN variety_id BIGINT REFERENCES crop_variety(id);
ALTER TABLE crop_cycle ADD COLUMN crop_catalog_id BIGINT REFERENCES crop_catalog(id);
ALTER TABLE crop_cycle ADD COLUMN variety_id BIGINT REFERENCES crop_variety(id);
ALTER TABLE planting_material_lot ADD COLUMN crop_catalog_id BIGINT REFERENCES crop_catalog(id);
ALTER TABLE planting_material_lot ADD COLUMN variety_id BIGINT REFERENCES crop_variety(id);

INSERT INTO crop_catalog (farm_id, code, name)
SELECT id, 'banana', 'Banano' FROM farm
ON CONFLICT (farm_id, code) DO NOTHING;

INSERT INTO crop_variety (crop_id, code, name)
SELECT id, 'cavendish', 'Cavendish'
FROM crop_catalog
WHERE code = 'banana'
ON CONFLICT (crop_id, code) DO NOTHING;

WITH crop_values AS (
  SELECT f.farm_id, b.crop
  FROM block b JOIN field f ON f.id = b.field_id
  UNION ALL
  SELECT f.farm_id, c.crop
  FROM crop_cycle c JOIN block b ON b.id = c.block_id JOIN field f ON f.id = b.field_id
  UNION ALL
  SELECT m.farm_id, m.crop
  FROM planting_material_lot m
)
INSERT INTO crop_catalog (farm_id, code, name)
SELECT farm_id, lower(trim(crop)), min(trim(crop))
FROM crop_values
WHERE crop IS NOT NULL AND trim(crop) <> ''
GROUP BY farm_id, lower(trim(crop))
ON CONFLICT (farm_id, code) DO NOTHING;

WITH variety_values AS (
  SELECT f.farm_id, b.crop, b.variety
  FROM block b JOIN field f ON f.id = b.field_id
  UNION ALL
  SELECT f.farm_id, c.crop, c.variety
  FROM crop_cycle c JOIN block b ON b.id = c.block_id JOIN field f ON f.id = b.field_id
  UNION ALL
  SELECT m.farm_id, m.crop, m.variety
  FROM planting_material_lot m
)
INSERT INTO crop_variety (crop_id, code, name)
SELECT c.id, lower(trim(v.variety)), min(trim(v.variety))
FROM variety_values v
JOIN crop_catalog c ON c.farm_id = v.farm_id AND c.code = lower(trim(v.crop))
WHERE v.variety IS NOT NULL AND trim(v.variety) <> ''
GROUP BY c.id, lower(trim(v.variety))
ON CONFLICT (crop_id, code) DO NOTHING;

UPDATE block b
SET crop_catalog_id = c.id
FROM field f JOIN crop_catalog c ON c.farm_id = f.farm_id
WHERE f.id = b.field_id AND c.code = lower(trim(b.crop)) AND b.crop_catalog_id IS NULL;

UPDATE block b
SET variety_id = v.id
FROM crop_variety v
WHERE v.crop_id = b.crop_catalog_id AND v.code = lower(trim(b.variety)) AND b.variety IS NOT NULL AND b.variety_id IS NULL;

UPDATE crop_cycle c
SET crop_catalog_id = cc.id
FROM block b JOIN field f ON f.id = b.field_id
JOIN crop_catalog cc ON cc.farm_id = f.farm_id
WHERE c.block_id = b.id AND cc.code = lower(trim(c.crop)) AND c.crop_catalog_id IS NULL;

UPDATE crop_cycle c
SET variety_id = v.id
FROM crop_variety v
WHERE v.crop_id = c.crop_catalog_id AND v.code = lower(trim(c.variety)) AND c.variety IS NOT NULL AND c.variety_id IS NULL;

UPDATE planting_material_lot m
SET crop_catalog_id = c.id
FROM crop_catalog c
WHERE c.farm_id = m.farm_id AND c.code = lower(trim(m.crop)) AND m.crop_catalog_id IS NULL;

UPDATE planting_material_lot m
SET variety_id = v.id
FROM crop_variety v
WHERE v.crop_id = m.crop_catalog_id AND v.code = lower(trim(m.variety)) AND m.variety IS NOT NULL AND m.variety_id IS NULL;
