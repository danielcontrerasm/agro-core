package com.yourco.agro.tasks;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.function.Function;
import java.util.Map;
import java.util.Set;

@Service
public class TaskService {
  private final JpaSql queries;
  private final FarmAccess access;
  private static final String SELECT = "SELECT t.*, u.name AS assignee FROM farm_task t JOIN app_user u ON u.id=t.assignee_id ";
  private static final Function<JpaSql.Row, TaskDtos.Task> MAPPER = result -> new TaskDtos.Task(
    result.text("id"), result.longValue("farm_id"), result.value("field_id", Long.class),
    result.value("block_id", Long.class), result.longValue("assignee_id"), result.text("assignee"),
    result.text("title"), TaskDtos.Activity.valueOf(result.text("activity")),
    result.date("scheduled_date"), result.time("scheduled_time"),
    TaskDtos.Priority.valueOf(result.text("priority")), TaskDtos.Status.valueOf(result.text("status")),
    result.text("instructions"), result.text("notes"), result.longValue("version"));

  public TaskService(JpaSql queries, FarmAccess access) { this.queries = queries; this.access = access; }

  public List<TaskDtos.Task> list(Long farmId) {
    if (farmId != null) access.require(farmId, false);
    String query = SELECT + """
      JOIN farm_membership m ON m.farm_id=t.farm_id AND m.user_id=?
      WHERE (m.role IN ('ADMIN', 'SUPERVISOR', 'AGRONOMIST') OR t.assignee_id=m.user_id)
      """;
    if (farmId == null) return queries.select(query + " ORDER BY t.scheduled_date, t.scheduled_time, t.id", MAPPER, access.userId());
    return queries.select(query + " AND t.farm_id=? ORDER BY t.scheduled_date, t.scheduled_time, t.id", MAPPER, access.userId(), farmId);
  }

  @Transactional
  public TaskDtos.Task create(TaskDtos.CreateRequest request) {
    access.requireAgronomic(request.farmId());
    if ((request.fieldId() == null) == (request.blockId() == null)) {
      throw failure(HttpStatus.BAD_REQUEST, "Selecciona un campo o un bloque, no ambos.");
    }
    Long targetFarm = request.fieldId() != null ? access.fieldFarm(request.fieldId()) : access.blockFarm(request.blockId());
    if (!request.farmId().equals(targetFarm)) throw failure(HttpStatus.BAD_REQUEST, "La ubicación no pertenece a esta finca.");
    var members = queries.values("SELECT user_id FROM farm_membership WHERE farm_id=? AND user_id=? FOR UPDATE",
      Long.class, request.farmId(), request.assigneeId());
    if (members.isEmpty()) throw failure(HttpStatus.BAD_REQUEST, "El responsable debe pertenecer a la finca.");
    long id = queries.insert("""
      INSERT INTO farm_task (farm_id, field_id, block_id, assignee_id, title, activity,
        scheduled_date, scheduled_time, priority, instructions, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """, request.farmId(), request.fieldId(), request.blockId(), request.assigneeId(), request.title().trim(),
      request.activity().name(), request.date(), request.time(), request.priority().name(), request.instructions().trim(),
      access.userId());
    return get(id);
  }

  @Transactional
  public TaskDtos.Task update(Long id, TaskDtos.UpdateRequest request) {
    var current = get(id);
    access.require(current.farmId(), false);
    String role = queries.value("SELECT role FROM farm_membership WHERE farm_id=? AND user_id=?",
      String.class, current.farmId(), access.userId());
    boolean manager = Set.of("ADMIN", "SUPERVISOR", "AGRONOMIST").contains(role);
    if (!manager && !current.assigneeId().equals(access.userId())) throw failure(HttpStatus.FORBIDDEN, "Solo puedes actualizar tus tareas.");
    if (request.version() != current.version()) throw failure(HttpStatus.CONFLICT, "La tarea cambió. Actualiza la página antes de continuar.");
    if (current.status() == TaskDtos.Status.review && !manager) throw failure(HttpStatus.FORBIDDEN, "La revisión requiere un administrador o supervisor.");
    Map<TaskDtos.Status, Set<TaskDtos.Status>> allowed = Map.of(
      TaskDtos.Status.pending, Set.of(TaskDtos.Status.progress, TaskDtos.Status.blocked),
      TaskDtos.Status.progress, Set.of(TaskDtos.Status.review, TaskDtos.Status.blocked),
      TaskDtos.Status.blocked, Set.of(TaskDtos.Status.progress),
      TaskDtos.Status.review, Set.of(TaskDtos.Status.completed, TaskDtos.Status.progress),
      TaskDtos.Status.completed, Set.of());
    if (!allowed.get(current.status()).contains(request.status())) throw failure(HttpStatus.BAD_REQUEST, "Cambio de estado no permitido.");
    if (request.status() == TaskDtos.Status.blocked && (request.notes() == null || request.notes().isBlank())) {
      throw failure(HttpStatus.BAD_REQUEST, "Describe el motivo del bloqueo.");
    }
    String notes = request.notes() == null || request.notes().isBlank() ? current.notes() : request.notes().trim();
    int changed = queries.execute("""
      UPDATE farm_task SET status=?, notes=?, version=version+1, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND version=?
      """, request.status().name(), notes, id, current.version());
    if (changed == 0) throw failure(HttpStatus.CONFLICT, "La tarea cambió. Actualiza la página antes de continuar.");
    return get(id);
  }

  private TaskDtos.Task get(Long id) {
    return queries.select(SELECT + "WHERE t.id=?", MAPPER, id).stream().findFirst()
      .orElseThrow(() -> failure(HttpStatus.NOT_FOUND, "Tarea no encontrada."));
  }

  private ResponseStatusException failure(HttpStatus status, String message) { return new ResponseStatusException(status, message); }
}
