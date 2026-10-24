package com.yourco.agro.events.service;

import com.yourco.agro.events.dto.CreateEventRequest;
import com.yourco.agro.events.entity.*;
import com.yourco.agro.events.repo.FieldEventRepository;
import com.yourco.agro.events.repo.ObservationDetailRepository;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.farm.repo.RowRepository;
import com.yourco.agro.geo.GeoMapper;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EventService {
  private final FieldEventRepository eventRepo;
  private final ObservationDetailRepository obsRepo;
  private final BlockRepository blockRepo;
  private final RowRepository rowRepo;
  private final GeoMapper geo = new GeoMapper();
  private final FarmAccess access;

  public EventService(FieldEventRepository eventRepo,
                      ObservationDetailRepository obsRepo,
                      BlockRepository blockRepo,
                      RowRepository rowRepo, FarmAccess access) {
    this.eventRepo = eventRepo;
    this.obsRepo = obsRepo;
    this.blockRepo = blockRepo;
    this.rowRepo = rowRepo;
    this.access = access;
  }

  @Transactional
  public FieldEvent create(CreateEventRequest req) {
    if (req.blockId == null && req.rowId == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Block or row is required");
    }
    if (req.blockId != null) access.require(access.blockFarm(req.blockId), false);
    if (req.rowId != null) access.require(access.rowFarm(req.rowId), false);
    if (req.blockId != null && req.rowId != null &&
        !rowRepo.findById(req.rowId).orElseThrow().getBlock().getId().equals(req.blockId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Row must belong to the specified block");
    }
    FieldEvent e = new FieldEvent();
    e.setEventType(req.eventType);
    e.setOccurredAt(req.occurredAt);
    e.setCreatedByUserId(access.userId());
    e.setNotes(req.notes);

    if (req.blockId != null) e.setBlock(blockRepo.findById(req.blockId).orElseThrow());
    if (req.rowId != null) e.setRow(rowRepo.findById(req.rowId).orElseThrow());

    e.setPlantIndexStart(req.plantIndexStart);
    e.setPlantIndexEnd(req.plantIndexEnd);

    if (req.geom != null) e.setGeom(geo.toPoint(req.geom));

    FieldEvent saved = eventRepo.save(e);

    if (req.eventType == EventType.SCOUTING_OBSERVATION && req.observation != null) {
      ObservationDetail od = new ObservationDetail();
      od.setEvent(saved);
      od.setSuspectedCatalogId(req.observation.suspectedCatalogId);
      od.setSeverity(req.observation.severity);
      od.setSymptoms(req.observation.symptoms);
      obsRepo.save(od);
    }

    return saved;
  }
}
