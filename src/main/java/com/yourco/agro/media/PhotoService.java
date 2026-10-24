package com.yourco.agro.media;

import com.yourco.agro.auth.FarmAccess;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
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
import java.util.UUID;

@Service
public class PhotoService {
  public static final int MAX_BYTES = 10 * 1024 * 1024;
  private static final long MAX_PIXELS = 24_000_000;
  private static final String COLUMNS = "id, event_id, inspection_id, treatment_id, original_name, content_type, size_bytes, created_by_user_id, created_at";
  private final JdbcTemplate jdbc;
  private final FarmAccess access;

  public record Photo(String id, Long eventId, Long inspectionId, Long treatmentId, String originalName,
    String contentType, int sizeBytes, Long createdByUserId, Instant createdAt) {}
  public record Content(Photo photo, byte[] bytes) {}
  private record Image(byte[] bytes, String contentType) {}
  private static final RowMapper<Photo> MAPPER = (result, rowNumber) -> new Photo(result.getString("id"),
    result.getObject("event_id", Long.class), result.getObject("inspection_id", Long.class), result.getObject("treatment_id", Long.class),
    result.getString("original_name"), result.getString("content_type"), result.getInt("size_bytes"),
    result.getLong("created_by_user_id"), result.getTimestamp("created_at").toInstant());

  public PhotoService(JdbcTemplate jdbc, FarmAccess access) { this.jdbc = jdbc; this.access = access; }

  private void authorize(Long eventId, Long inspectionId, Long treatmentId, boolean write) {
    if ((eventId == null) == (inspectionId == null) || (eventId != null && treatmentId != null)) {
      throw error(HttpStatus.BAD_REQUEST, "Indica un evento o una inspección; el tratamiento requiere inspección");
    }
    if (eventId != null) {
      access.require(access.eventFarm(eventId), false);
      if (write) jdbc.queryForObject("SELECT id FROM field_event WHERE id = ? FOR UPDATE", Long.class, eventId);
    } else {
      Long farmId = jdbc.queryForList("""
        SELECT f.farm_id FROM phytosanitary_inspection i JOIN block b ON b.id = i.block_id
        JOIN field f ON f.id = b.field_id WHERE i.id = ?
        """, Long.class, inspectionId).stream().findFirst()
        .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Inspección no encontrada"));
      access.require(farmId, false);
      if (write) {
        var canceled = jdbc.queryForObject("SELECT canceled_at FROM phytosanitary_inspection WHERE id = ? FOR UPDATE",
          (result, rowNumber) -> result.getTimestamp("canceled_at"), inspectionId);
        if (canceled != null) throw error(HttpStatus.CONFLICT, "La inspección está anulada");
      }
      if (treatmentId != null && jdbc.queryForObject("SELECT COUNT(*) FROM inspection_treatment WHERE id = ? AND inspection_id = ?",
        Integer.class, treatmentId, inspectionId) == 0) throw error(HttpStatus.BAD_REQUEST, "El tratamiento no pertenece a esta inspección");
    }
  }

  @Transactional
  public Photo upload(Long eventId, Long inspectionId, Long treatmentId, MultipartFile file) {
    authorize(eventId, inspectionId, treatmentId, true);
    var image = decode(file);
    String original = file.getOriginalFilename() == null ? "foto" : file.getOriginalFilename().replace('\\', '/');
    original = original.substring(original.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
    if (original.isBlank()) original = "foto";
    if (original.length() > 250) original = original.substring(original.length() - 250);
    String id = UUID.randomUUID().toString();
    jdbc.update("""
      INSERT INTO photo_asset(id, event_id, inspection_id, treatment_id, original_name, content_type,
        size_bytes, image_data, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      """, id, eventId, inspectionId, treatmentId, original, image.contentType(), image.bytes().length, image.bytes(), access.userId());
    return get(id);
  }

  public List<Photo> list(Long eventId, Long inspectionId, Long treatmentId) {
    authorize(eventId, inspectionId, treatmentId, false);
    if (eventId != null) return jdbc.query("SELECT " + COLUMNS + " FROM photo_asset WHERE event_id = ? ORDER BY created_at, id", MAPPER, eventId);
    if (treatmentId != null) return jdbc.query("SELECT " + COLUMNS + " FROM photo_asset WHERE inspection_id = ? AND treatment_id = ? ORDER BY created_at, id", MAPPER, inspectionId, treatmentId);
    return jdbc.query("SELECT " + COLUMNS + " FROM photo_asset WHERE inspection_id = ? ORDER BY created_at, id", MAPPER, inspectionId);
  }

  public Photo get(String id) {
    var photo = jdbc.query("SELECT " + COLUMNS + " FROM photo_asset WHERE id = ?", MAPPER, id).stream().findFirst()
      .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Foto no encontrada"));
    authorize(photo.eventId(), photo.inspectionId(), photo.treatmentId(), false);
    return photo;
  }

  @Transactional(readOnly = true)
  public Content content(String id) {
    var photo = get(id);
    return new Content(photo, jdbc.queryForObject("SELECT image_data FROM photo_asset WHERE id = ?", byte[].class, id));
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
