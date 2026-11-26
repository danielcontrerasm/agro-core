package com.yourco.agro.events.service;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.events.dto.LegacyObservationDtos.Edit;
import com.yourco.agro.events.dto.LegacyObservationDtos.Observation;
import com.yourco.agro.events.dto.LegacyObservationDtos.Revision;
import com.yourco.agro.events.dto.LegacyObservationDtos.Snapshot;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class LegacyObservationService {
  private final JpaSql queries;
  private final FarmAccess access;

  public LegacyObservationService(JpaSql queries, FarmAccess access) {
    this.queries = queries;
    this.access = access;
  }

  @Transactional(readOnly = true)
  public Observation get(long id) {
    access.require(access.eventFarm(id), false);
    return observation(id, current(id));
  }

  @Transactional
  public Observation edit(long id, Edit request) {
    access.requireAgronomic(access.eventFarm(id));
    queries.values("SELECT id FROM field_event WHERE id = ? FOR UPDATE", Long.class, id).stream()
      .findFirst().orElseThrow(LegacyObservationService::notFound);
    var previous = current(id);
    if (request.getVersion() != previous.version()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "La observación cambió. Actualiza antes de editar.");
    }
    var before = previous.snapshot();
    var after = replacement(request, before);
    if (before.equals(after)) {
      throw badRequest("Cambia al menos un dato de la observación.");
    }

    long version = previous.version() + 1;
    int changed = queries.execute("""
      UPDATE observation_detail SET symptoms = ?, severity = ?, problem_code = ? WHERE event_id = ?
      """, after.symptoms(), after.severity(), after.problemCode(), id);
    if (changed == 0) {
      queries.execute("""
        INSERT INTO observation_detail (event_id, symptoms, severity, problem_code) VALUES (?, ?, ?, ?)
        """, id, after.symptoms(), after.severity(), after.problemCode());
    }
    queries.execute("UPDATE field_event SET notes = ?, legacy_observation_version = ? WHERE id = ?", after.notes(), version, id);
    queries.execute("""
      INSERT INTO legacy_observation_revision (
        event_id, version, edited_by_user_id, reason,
        before_notes, before_symptoms, before_severity, before_problem_code,
        after_notes, after_symptoms, after_severity, after_problem_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """, id, version, access.userId(), request.getReason().strip(),
      before.notes(), before.symptoms(), before.severity(), before.problemCode(),
      after.notes(), after.symptoms(), after.severity(), after.problemCode());
    return observation(id, new Current(version, previous.suspectedCatalogId(), after));
  }

  private record Current(long version, Long suspectedCatalogId, Snapshot snapshot) {}

  private Current current(long id) {
    return queries.select("""
      SELECT e.legacy_observation_version, e.notes, d.symptoms, d.severity,
        d.problem_code, d.suspected_catalog_id
      FROM field_event e LEFT JOIN observation_detail d ON d.event_id = e.id
      WHERE e.id = ? AND e.event_type = 'SCOUTING_OBSERVATION'
      """, row -> new Current(row.longValue("legacy_observation_version"), row.value("suspected_catalog_id", Long.class),
      new Snapshot(row.text("notes"), row.text("symptoms"), row.value("severity", Integer.class), row.text("problem_code"))), id)
      .stream().findFirst().orElseThrow(LegacyObservationService::notFound);
  }

  private Observation observation(long id, Current current) {
    List<Revision> history = queries.select("""
      SELECT r.*, u.name AS editor_name
      FROM legacy_observation_revision r JOIN app_user u ON u.id = r.edited_by_user_id
      WHERE r.event_id = ? AND r.version <= ? ORDER BY r.version DESC
      """, row -> new Revision(row.longValue("version"), row.instant("edited_at"), row.longValue("edited_by_user_id"),
      row.text("editor_name"), row.text("reason"), snapshot(row, "before_"), snapshot(row, "after_")),
      id, current.version());
    var value = current.snapshot();
    return new Observation(id, current.version(), value.notes(), value.symptoms(), value.severity(),
      value.problemCode(), current.suspectedCatalogId(), history);
  }

  private static Snapshot snapshot(JpaSql.Row row, String prefix) {
    return new Snapshot(row.text(prefix + "notes"), row.text(prefix + "symptoms"),
      row.value(prefix + "severity", Integer.class), row.text(prefix + "problem_code"));
  }

  private Snapshot replacement(Edit request, Snapshot before) {
    String notes = request.hasNotes() ? editableText(request.getNotes(), before.notes()) : before.notes();
    String symptoms = request.hasSymptoms() ? editableText(request.getSymptoms(), before.symptoms()) : before.symptoms();
    Integer severity = request.hasSeverity() ? request.getSeverity() : before.severity();
    if (!Objects.equals(severity, before.severity()) && severity != null && (severity < 1 || severity > 5)) {
      throw badRequest("La severidad debe estar entre 1 y 5.");
    }
    String problem = request.hasProblemCode() ? normalizeProblemCode(request.getProblemCode()) : before.problemCode();
    if (problem != null && !Objects.equals(problem, before.problemCode())
        && queries.values("SELECT code FROM phytosanitary_problem WHERE code = ? AND active = TRUE", String.class, problem).isEmpty()) {
      throw badRequest("Selecciona un problema fitosanitario activo del catálogo.");
    }
    return new Snapshot(notes, symptoms, severity, problem);
  }

  private static String normalizeProblemCode(String input) {
    return input == null || input.isBlank() ? null : input.strip().toUpperCase(Locale.ROOT);
  }

  private static String editableText(String input, String previous) {
    if (Objects.equals(input, previous)) return previous;
    if (input == null || input.isBlank()) return null;
    String text = input.strip();
    if (text.length() > 4000) throw badRequest("Cada texto de la observación admite hasta 4.000 caracteres.");
    return text;
  }

  private static ResponseStatusException notFound() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Observación histórica no encontrada.");
  }

  private static ResponseStatusException badRequest(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
