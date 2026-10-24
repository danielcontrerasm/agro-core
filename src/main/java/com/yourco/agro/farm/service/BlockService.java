package com.yourco.agro.farm.service;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.catalog.CropCatalogService;
import com.yourco.agro.farm.dto.BlockDtos;
import com.yourco.agro.farm.entity.Block;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.farm.repo.FieldRepository;
import com.yourco.agro.geo.GeoMapper;
import org.springframework.stereotype.Service;

@Service
public class BlockService {
  private final BlockRepository blockRepo;
  private final FieldRepository fieldRepo;
  private final FarmAccess access;
  private final CropCatalogService catalog;
  private final GeoMapper geo = new GeoMapper();

  public BlockService(BlockRepository blockRepo, FieldRepository fieldRepo, FarmAccess access, CropCatalogService catalog) {
    this.blockRepo = blockRepo;
    this.fieldRepo = fieldRepo;
    this.access = access;
    this.catalog = catalog;
  }

  public Block create(BlockDtos.CreateBlockRequest req) {
    Block b = new Block();
    b.setField(fieldRepo.findById(req.fieldId).orElseThrow());
    b.setCode(req.code);
    var selection = catalog.resolve(access.fieldFarm(req.fieldId), req.cropId, req.varietyId);
    if (selection != null) {
      b.setCropId(selection.cropId());
      b.setVarietyId(selection.varietyId());
      b.setCrop(selection.crop());
      b.setVariety(selection.variety());
    } else {
      if (req.crop != null) b.setCrop(req.crop);
      b.setVariety(req.variety);
    }
    b.setGeom(geo.toPolygon(req.polygon));
    b.setAreaHa(req.areaHa);
    return blockRepo.save(b);
  }
}
