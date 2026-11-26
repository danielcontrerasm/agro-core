package com.yourco.agro.media;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.function.Function;
import java.util.UUID;

@Service
public class PhotoService {
  public static final int MAX_BYTES = 10 * 1024 * 1024;
  private static final long MAX_PIXELS = 24_000_000;
  private static final String COLUMNS = "id, event_id, inspection_id, treatment_id, analysis_id, original_name, content_type, size_bytes, created_by_user_id, created_at";
  private final JpaSql queries;
  private final FarmAccess access;

  public record Target(Long eventId, Long inspectionId, Long treatmentId, Long analysisId) {}
  public record Photo(String id, Long eventId, Long inspectionId, Long treatmentId, Long analysisId, String originalName,
    String contentType, int sizeBytes, Long createdByUserId, Instant createdAt) {}
  public record Content(Photo photo, byte[] bytes) {}
  private record SampleScope(long farmId, long authorId) {}
  private record Image(byte[] bytes, String contentType) {}
  private static final Function<JpaSql.Row, Photo> MAPPER = result -> new Photo(result.text("id"),
    result.value("event_id", Long.class), result.value("inspection_id", Long.class), result.value("treatment_id", Long.class),
    result.value("analysis_id", Long.class), result.text("original_name"), result.text("content_type"), result.intValue("size_bytes"),
    result.longValue("created_by_user_id"), result.instant("created_at"));

  public PhotoService(JpaSql queries, FarmAccess access) { this.queries = queries; this.access = access; }

  private void authorize(Target target, boolean write) {
    Long eventId = target.eventId();
    Long inspectionId = target.inspectionId();
    Long treatmentId = target.treatmentId();
    Long analysisId = target.analysisId();
    int targetCount = (eventId == null ? 0 : 1) + (inspectionId == null ? 0 : 1) + (analysisId == null ? 0 : 1);
    if (targetCount != 1 || (treatmentId != null && inspectionId == null)) {
      throw error(HttpStatus.BAD_REQUEST, "Indica un evento, una inspección o una muestra. El tratamiento requiere inspección");
    }
    if (eventId != null) {
      access.require(access.eventFarm(eventId), false);
      if (write) queries.value("SELECT id FROM field_event WHERE id = ? FOR UPDATE", Long.class, eventId);
    } else if (analysisId != null) {
      authorizeSample(analysisId, write);
    } else {
      Long farmId = queries.values("""
        SELECT f.farm_id FROM phytosanitary_inspection i JOIN block b ON b.id = i.block_id
        JOIN field f ON f.id = b.field_id WHERE i.id = ?
        """, Long.class, inspectionId).stream().findFirst()
        .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Inspección no encontrada"));
      access.require(farmId, false);
      if (write) {
        var canceled = queries.value("SELECT canceled_at FROM phytosanitary_inspection WHERE id = ? FOR UPDATE",
          Instant.class, inspectionId);
        if (canceled != null) throw error(HttpStatus.CONFLICT, "La inspección está anulada");
      }
      if (treatmentId != null && queries.value("SELECT COUNT(*) FROM inspection_treatment WHERE id = ? AND inspection_id = ?",
        Integer.class, treatmentId, inspectionId) == 0) throw error(HttpStatus.BAD_REQUEST, "El tratamiento no pertenece a esta inspección");
    }
  }

  private void authorizeSample(long analysisId, boolean write) {
    var scope = queries.select("""
      SELECT f.farm_id, s.created_by FROM soil_analysis s JOIN block b ON b.id = s.block_id
      JOIN field f ON f.id = b.field_id WHERE s.id = ?
      """, row -> new SampleScope(row.longValue("farm_id"), row.longValue("created_by")), analysisId)
      .stream().findFirst().orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Muestra no encontrada"));
    access.require(scope.farmId(), false);
    if (write && scope.authorId() != access.userId()) access.requireAgronomic(scope.farmId());
  }

  @Transactional
  public Photo upload(Target target, MultipartFile file) {
    authorize(target, true);
    var image = decode(file);
    String original = file.getOriginalFilename() == null ? "foto" : file.getOriginalFilename().replace('\\', '/');
    original = original.substring(original.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
    if (original.isBlank()) original = "foto";
    if (original.length() > 250) original = original.substring(original.length() - 250);
    String id = UUID.randomUUID().toString();
    queries.execute("""
      INSERT INTO photo_asset(id, event_id, inspection_id, treatment_id, analysis_id, original_name, content_type,
        size_bytes, image_data, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """, id, target.eventId(), target.inspectionId(), target.treatmentId(), target.analysisId(),
      original, image.contentType(), image.bytes().length, image.bytes(), access.userId());
    return get(id);
  }

  public List<Photo> list(Target target) {
    authorize(target, false);
    Long eventId = target.eventId();
    Long inspectionId = target.inspectionId();
    Long treatmentId = target.treatmentId();
    if (eventId != null) return queries.select("SELECT " + COLUMNS + " FROM photo_asset WHERE event_id = ? ORDER BY created_at, id", MAPPER, eventId);
    if (target.analysisId() != null) return queries.select("SELECT " + COLUMNS + " FROM photo_asset WHERE analysis_id = ? ORDER BY created_at, id", MAPPER, target.analysisId());
    if (treatmentId != null) return queries.select("SELECT " + COLUMNS + " FROM photo_asset WHERE inspection_id = ? AND treatment_id = ? ORDER BY created_at, id", MAPPER, inspectionId, treatmentId);
    return queries.select("SELECT " + COLUMNS + " FROM photo_asset WHERE inspection_id = ? ORDER BY created_at, id", MAPPER, inspectionId);
  }

  public Photo get(String id) {
    var photo = queries.select("SELECT " + COLUMNS + " FROM photo_asset WHERE id = ?", MAPPER, id).stream().findFirst()
      .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Foto no encontrada"));
    authorize(new Target(photo.eventId(), photo.inspectionId(), photo.treatmentId(), photo.analysisId()), false);
    return photo;
  }

  @Transactional(readOnly = true)
  public Content content(String id) {
    var photo = get(id);
    return new Content(photo, queries.value("SELECT image_data FROM photo_asset WHERE id = ?", byte[].class, id));
  }

  private Image decode(MultipartFile file) {
    if (file.isEmpty()) throw error(HttpStatus.BAD_REQUEST, "Selecciona una foto");
    if (file.getSize() > MAX_BYTES) throw error(HttpStatus.PAYLOAD_TOO_LARGE, "Cada foto debe pesar como máximo 10 MB");
    try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
      var readers = ImageIO.getImageReaders(input);
      if (!readers.hasNext()) throw error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "La foto debe ser JPEG o PNG válido");
      var reader = readers.next();
      try {
        String format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
        if (!List.of("jpeg", "jpg", "png").contains(format)) throw error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Solo se admiten fotos JPEG y PNG");
        reader.setInput(input, true, true);
        long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
        if (pixels < 1 || pixels > MAX_PIXELS) throw error(HttpStatus.BAD_REQUEST, "La foto debe tener como máximo 24 megapíxeles");
        var decoded = reader.read(0);
        var output = new ByteArrayOutputStream();
        String outputFormat = format.equals("png") ? "png" : "jpeg";
        if (!ImageIO.write(decoded, outputFormat, output)) throw error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "No se pudo procesar la foto");
        if (output.size() > MAX_BYTES) throw error(HttpStatus.PAYLOAD_TOO_LARGE, "La foto procesada supera los 10 MB");
        return new Image(output.toByteArray(), "image/" + outputFormat);
      } finally { reader.dispose(); }
    } catch (IOException | IllegalArgumentException exception) {
      throw error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "No se pudo leer la imagen; selecciona un JPEG o PNG válido");
    }
  }

  private ResponseStatusException error(HttpStatus status, String message) { return new ResponseStatusException(status, message); }
}
