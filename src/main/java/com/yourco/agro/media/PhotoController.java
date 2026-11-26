package com.yourco.agro.media;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/photos")
public class PhotoController {
  private final PhotoService service;
  public PhotoController(PhotoService service) { this.service = service; }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public PhotoService.Photo upload(@RequestParam(required = false) Long eventId,
    @RequestParam(required = false) Long inspectionId, @RequestParam(required = false) Long treatmentId,
    @RequestParam(required = false) Long analysisId, @RequestParam MultipartFile file) {
    return service.upload(new PhotoService.Target(eventId, inspectionId, treatmentId, analysisId), file);
  }

  @GetMapping
  public List<PhotoService.Photo> list(@RequestParam(required = false) Long eventId,
    @RequestParam(required = false) Long inspectionId, @RequestParam(required = false) Long treatmentId,
    @RequestParam(required = false) Long analysisId) {
    return service.list(new PhotoService.Target(eventId, inspectionId, treatmentId, analysisId));
  }

  @GetMapping("/{id}/content")
  public ResponseEntity<byte[]> content(@PathVariable String id, @RequestParam(defaultValue = "false") boolean download) {
    var content = service.content(id);
    String name = "foto-" + content.photo().id() + (content.photo().contentType().equals("image/png") ? ".png" : ".jpg");
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(content.photo().contentType()))
      .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options", "nosniff")
      .header(HttpHeaders.CONTENT_DISPOSITION, (download ? "attachment" : "inline") + "; filename=\"" + name + "\"")
      .body(content.bytes());
  }
}
