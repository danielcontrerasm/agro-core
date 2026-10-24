package com.yourco.agro.media.controller;

import com.yourco.agro.events.repo.FieldEventRepository;
import com.yourco.agro.geo.GeoMapper;
import com.yourco.agro.media.dto.MediaDtos;
import com.yourco.agro.media.entity.MediaAsset;
import com.yourco.agro.media.repo.MediaAssetRepository;
import jakarta.validation.Valid;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/media")
public class MediaController {
  private final MediaAssetRepository repo;
  private final FieldEventRepository eventRepo;
  private final GeoMapper geo = new GeoMapper();
  private final FarmAccess access;

  public MediaController(MediaAssetRepository repo, FieldEventRepository eventRepo, FarmAccess access) {
    this.repo = repo;
    this.eventRepo = eventRepo;
    this.access = access;
  }

  @PostMapping
  public Object register(@Valid @RequestBody MediaDtos.RegisterMediaRequest req) {
    access.require(access.eventFarm(req.eventId), false);
    MediaAsset m = new MediaAsset();
    m.setEvent(eventRepo.findById(req.eventId).orElseThrow());
    m.setKind(req.kind);
    m.setS3Key(req.s3Key);
    m.setContentType(req.contentType);
    m.setCapturedAt(req.capturedAt);
    if (req.gps != null) m.setGpsGeom(geo.toPoint(req.gps));
    m.setMeta(req.metaJson);
    return repo.save(m);
  }

  @GetMapping
  public Object list(@RequestParam Long eventId) {
    access.require(access.eventFarm(eventId), false);
    return repo.findByEvent_Id(eventId);
  }
}
