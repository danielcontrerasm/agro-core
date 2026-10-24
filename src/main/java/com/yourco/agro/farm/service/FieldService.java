package com.yourco.agro.farm.service;

import com.yourco.agro.farm.dto.FieldDtos;
import com.yourco.agro.farm.entity.Field;
import com.yourco.agro.farm.repo.FarmRepository;
import com.yourco.agro.farm.repo.FieldRepository;
import com.yourco.agro.geo.GeoMapper;
import org.springframework.stereotype.Service;

@Service
public class FieldService {
  private final FieldRepository fieldRepo;
  private final FarmRepository farmRepo;
  private final GeoMapper geo = new GeoMapper();

  public FieldService(FieldRepository fieldRepo, FarmRepository farmRepo) {
    this.fieldRepo = fieldRepo;
    this.farmRepo = farmRepo;
  }

  public Field create(FieldDtos.CreateFieldRequest req) {
    Field f = new Field();
    f.setFarm(farmRepo.findById(req.farmId).orElseThrow());
    f.setName(req.name);
    f.setGeom(geo.toPolygon(req.polygon));
    f.setAreaHa(req.areaHa);
    return fieldRepo.save(f);
  }
}
