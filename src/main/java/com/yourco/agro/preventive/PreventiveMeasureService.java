package com.yourco.agro.preventive;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import static com.yourco.agro.preventive.PreventiveMeasureDtos.*;

@Service
public class PreventiveMeasureService {
  private static final String TEMPLATE_SELECT = """
    SELECT t.id, t.farm_id, t.code, t.name, t.category, t.instructions, t.active,
      t.created_by_user_id, u.name AS creator_name, t.created_at
    FROM preventive_measure_template t
    JOIN app_user u ON u.id = t.created_by_user_id
    WHERE t.farm_id = ?
    ORDER BY t.active DESC, lower(t.name), t.id
    """;

  private static final String ASSIGNMENT_SELECT = """
    SELECT a.id, f.farm_id, a.template_id, t.code AS template_code, t.name AS template_name,
      t.category, t.instructions, a.block_id, b.code AS block_code, a.scheduled_for,
      a.assigned_to_user_id, assigned.name AS assigned_to_name, a.status, a.completion_notes,
      a.completed_at, a.completed_by_user_id, completed.name AS completed_by_name,
      a.created_by_user_id, creator.name AS creator_name, a.created_at, a.updated_at, a.version
    FROM preventive_measure_assignment a
    JOIN preventive_measure_template t ON t.id = a.template_id
    JOIN block b ON b.id = a.block_id
    JOIN field f ON f.id = b.field_id
    LEFT JOIN app_user assigned ON assigned.id = a.assigned_to_user_id
    LEFT JOIN app_user completed ON completed.id = a.completed_by_user_id
    JOIN app_user creator ON creator.id = a.created_by_user_id
    WHERE f.farm_id = ?
    """;

  private final JpaSql queries;
  private final FarmAccess access;

  public PreventiveMeasureService(JpaSql queries, FarmAccess access) {
    this.queries = queries;
    this.access = access;
  }

  public List<Template> templates(long farmId) {
    access.require(farmId, false);
    return queries.select(TEMPLATE_SELECT, result -> mapTemplate(result), farmId);
  }

  @Transactional
  public Template createTemplate(CreateTemplate request) {
    access.requireAgronomic(request.farmId());
    String code = normalize(request.code());
    if (queries.value("SELECT COUNT(*) FROM preventive_measure_template WHERE farm_id = ? AND lower(code) = ?",
      Integer.class, request.farmId(), code) > 0) {
      throw conflict("Ya existe una medida preventiva con ese código en la finca");
    }
    long id = queries.insert("""
      INSERT INTO preventive_measure_template(farm_id,code,name,category,instructions,created_by_user_id)
      VALUES (?,?,?,?,?,?)
      """, request.farmId(), code, request.name().trim(), request.category().name(), request.instructions().trim(), access.userId());
    return templates(request.farmId()).stream().filter(template -> template.id().equals(id)).findFirst().orElseThrow();
  }

  @Transactional
  public void deactivateTemplate(long id) {
    var template = templateRow(id);
    access.requireAgronomic(((Number) template.get("farm_id")).longValue());
    queries.execute("UPDATE preventive_measure_template SET active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
  }

  public List<Assignment> assignments(long farmId, AssignmentStatus status) {
    access.require(farmId, false);
    String query = ASSIGNMENT_SELECT;
    if (status != null) query += " AND a.status = ?";
    query += " ORDER BY CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END, a.scheduled_for, a.id";
    return status == null
      ? queries.select(query, result -> mapAssignment(result), farmId)
      : queries.select(query, result -> mapAssignment(result), farmId, status.name());
  }

  @Transactional
  public Assignment createAssignment(CreateAssignment request) {
    long farmId = access.blockFarm(request.blockId());
    access.require(farmId, false);
    var template = templateRow(request.templateId());
    long templateFarmId = ((Number) template.get("farm_id")).longValue();
    if (templateFarmId != farmId) throw badRequest("La medida preventiva no pertenece a la finca del bloque");
    if (!Boolean.TRUE.equals(template.get("active"))) throw badRequest("La medida preventiva está inactiva");
    validateAssignee(farmId, request.assignedToUserId());
    long id = queries.insert("""
      INSERT INTO preventive_measure_assignment(template_id,block_id,scheduled_for,assigned_to_user_id,created_by_user_id)
      VALUES (?,?,?,?,?)
      """, request.templateId(), request.blockId(), request.scheduledFor(),
      request.assignedToUserId(), access.userId());
    return getAssignment(id);
  }

  @Transactional
  public Assignment updateAssignment(long id, UpdateAssignment request) {
    var assignment = getAssignment(id);
    if (assignment.status() == AssignmentStatus.COMPLETED && request.status() != AssignmentStatus.COMPLETED) {
      throw conflict("Una medida completada no puede volver a un estado pendiente");
    }
    String notes = request.completionNotes() == null ? null : request.completionNotes().trim();
    if (request.status() == AssignmentStatus.COMPLETED && (notes == null || notes.isBlank())) {
      throw badRequest("Describe la evidencia o el resultado antes de marcar la medida como completada");
    }
    Instant completedAt = request.status() == AssignmentStatus.COMPLETED
      ? (assignment.completedAt() == null ? Instant.now() : assignment.completedAt()) : null;
    Long completedBy = request.status() == AssignmentStatus.COMPLETED
      ? (assignment.completedByUserId() == null ? access.userId() : assignment.completedByUserId()) : null;
    int changed = queries.execute("""
      UPDATE preventive_measure_assignment
      SET status = ?, completion_notes = ?, completed_at = ?, completed_by_user_id = ?,
        version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
      """, request.status().name(), notes, completedAt,
      completedBy, id, request.version());
    if (changed == 0) throw conflict("La asignación cambió; actualiza antes de guardarla");
    return getAssignment(id);
  }

  public List<Evidence> evidence(long assignmentId) {
    getAssignment(assignmentId);
    return queries.select("""
      SELECT e.id, e.assignment_id, e.kind, e.s3_key, e.content_type,
        e.created_by_user_id, u.name AS author_name, e.created_at
      FROM preventive_measure_evidence e JOIN app_user u ON u.id = e.created_by_user_id
      WHERE e.assignment_id = ? ORDER BY e.created_at DESC, e.id DESC
      """, result -> mapEvidence(result), assignmentId);
  }

  @Transactional
  public Evidence addEvidence(long assignmentId, EvidenceRequest request) {
    getAssignment(assignmentId);
    long id = queries.insert("""
      INSERT INTO preventive_measure_evidence(assignment_id,kind,s3_key,content_type,created_by_user_id)
      VALUES (?,?,?,?,?)
      """, assignmentId, request.kind().name(), request.s3Key().trim(), request.contentType(), access.userId());
    return evidence(assignmentId).stream().filter(item -> item.id().equals(id)).findFirst().orElseThrow();
  }

  private Assignment getAssignment(long id) {
    return queries.select(ASSIGNMENT_SELECT.replace("WHERE f.farm_id = ?", "WHERE a.id = ?"),
      result -> mapAssignment(result), id).stream().findFirst().map(assignment -> {
        access.require(assignment.farmId(), false);
        return assignment;
      }).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asignación preventiva no encontrada"));
  }

  private java.util.Map<String, Object> templateRow(long id) {
    var rows = queries.rows("SELECT * FROM preventive_measure_template WHERE id = ?", id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Medida preventiva no encontrada");
    return rows.get(0);
  }

  private void validateAssignee(long farmId, Long userId) {
    if (userId == null) return;
    if (queries.value("SELECT COUNT(*) FROM farm_membership WHERE farm_id = ? AND user_id = ?",
      Integer.class, farmId, userId) == 0) throw badRequest("El responsable no pertenece a la finca");
  }

  private Template mapTemplate(JpaSql.Row result) {
    return new Template(result.longValue("id"), result.longValue("farm_id"), result.text("code"),
      result.text("name"), Category.valueOf(result.text("category")), result.text("instructions"),
      result.booleanValue("active"), result.longValue("created_by_user_id"), result.text("creator_name"),
      result.instant("created_at"));
  }

  private Assignment mapAssignment(JpaSql.Row result) {
    var completedAt = result.instant("completed_at");
    return new Assignment(result.longValue("id"), result.longValue("farm_id"), result.longValue("template_id"),
      result.text("template_code"), result.text("template_name"), Category.valueOf(result.text("category")),
      result.text("instructions"), result.longValue("block_id"), result.text("block_code"),
      result.date("scheduled_for"), result.value("assigned_to_user_id", Long.class),
      result.text("assigned_to_name"), AssignmentStatus.valueOf(result.text("status")),
      result.text("completion_notes"), completedAt,
      result.value("completed_by_user_id", Long.class), result.text("completed_by_name"),
      result.longValue("created_by_user_id"), result.text("creator_name"), result.instant("created_at"),
      result.instant("updated_at"), result.longValue("version"));
  }

  private Evidence mapEvidence(JpaSql.Row result) {
    return new Evidence(result.longValue("id"), result.longValue("assignment_id"),
      EvidenceKind.valueOf(result.text("kind")), result.text("s3_key"), result.text("content_type"),
      result.longValue("created_by_user_id"), result.text("author_name"), result.instant("created_at"));
  }


  private String normalize(String value) { return value.trim().toLowerCase(Locale.ROOT); }
  private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
  private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
