package com.yourco.agro.farm.service;

import com.yourco.agro.farm.dto.RowDtos;
import com.yourco.agro.farm.entity.RowLine;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.farm.repo.RowRepository;
import com.yourco.agro.geo.GeoMapper;
import org.springframework.stereotype.Service;

@Service
public class RowService {
  private final RowRepository rowRepo;
  private final BlockRepository blockRepo;
  private final GeoMapper geo = new GeoMapper();

  public RowService(RowRepository rowRepo, BlockRepository blockRepo) {
    this.rowRepo = rowRepo;
    this.blockRepo = blockRepo;
  }

  public RowLine create(RowDtos.CreateRowRequest req) {
    RowLine r = new RowLine();
    r.setBlock(blockRepo.findById(req.blockId).orElseThrow());
    r.setRowCode(req.rowCode);
    r.setGeom(geo.toLineString(req.line));
    r.setLengthM(req.lengthM);
    r.setPlantSpacingM(req.plantSpacingM);
    r.setPlantsEstimated(req.plantsEstimated);
    return rowRepo.save(r);
  }
}
