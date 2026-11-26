package com.yourco.agro.inspections;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

import static com.yourco.agro.inspections.InspectionMonitoringDtos.*;

@Service
public class InspectionMonitoringService {
  private static final String PLAN_SELECT = """
    SELECT p.*, f.farm_id, i.id AS last_inspection_id, i.inspected_at AS last_inspected_at
    FROM phytosanitary_monitoring_plan p
    JOIN block b ON b.id = p.block_id
    JOIN field f ON f.id = b.field_id
    LEFT JOIN phytosanitary_inspection i ON i.id = (
      SELECT visit.id FROM phytosanitary_inspection visit
      WHERE visit.block_id = p.block_id AND visit.problem_code = p.problem_code
        AND visit.canceled_at IS NULL
      ORDER BY visit.inspected_at DESC, visit.id DESC LIMIT 1
    )
    """;
  private static final String ALERT_SELECT = """
    SELECT a.*, p.block_id, p.problem_code, f.farm_id, i.canceled_at AS inspection_canceled_at
    FROM phytosanitary_monitoring_alert a
    JOIN phytosanitary_monitoring_plan p ON p.id = a.plan_id
    JOIN phytosanitary_inspection i ON i.id = a.inspection_id
    JOIN block b ON b.id = p.block_id
    JOIN field f ON f.id = b.field_id
    """;
  private final JpaSql queries;
  private final FarmAccess access;

  public InspectionMonitoringService(JpaSql queries, FarmAccess access) {
    this.queries = queries;
    this.access = access;
  }

  public List<Plan> plans(long farmId) {
    access.require(farmId, false);
    var today = LocalDate.now(ZoneOffset.UTC);
    return queries.select(PLAN_SELECT + " WHERE f.farm_id = ? ORDER BY p.block_id, p.problem_code",
      row -> plan(row, today), farmId);
  }

  @Transactional
  public Plan createPlan(CreatePlanRequest request) {
    access.requireAgronomic(request.farmId());
    Long actualFarm = access.blockFarm(request.blockId());
    access.requireAgronomic(actualFarm);
    if (!Objects.equals(request.farmId(), actualFarm)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El bloque debe pertenecer a la finca seleccionada");
    }
    String problem = InspectionService.normalizeCode(request.problemCode());
    requireActiveProblem(problem);
    checkRange(request.startDate(), request.incidenceThresholdPercent());
    long id;
    try {
      id = queries.insert("""
        INSERT INTO phytosanitary_monitoring_plan (block_id, problem_code, start_date, interval_days, incidence_threshold_percent)
        VALUES (?, ?, ?, ?, ?)
        """, request.blockId(), problem, request.startDate(), request.intervalDays(), request.incidenceThresholdPercent());
    } catch (DuplicateKeyException duplicate) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un plan para este bloque y problema");
    }
    return findPlan(id);
  }

  @Transactional
  public Plan updatePlan(long id, UpdatePlanRequest request) {
    var plan = findPlan(id);
    access.requireAgronomic(plan.farmId());
    checkRange(request.startDate(), request.incidenceThresholdPercent());
    int changed = queries.execute("""
      UPDATE phytosanitary_monitoring_plan
      SET start_date = ?, interval_days = ?, incidence_threshold_percent = ?, version = version + 1
      WHERE id = ? AND version = ?
      """, request.startDate(), request.intervalDays(), request.incidenceThresholdPercent(), id, request.version());
    requirePlanChanged(changed);
    return findPlan(id);
  }

  @Transactional
  public Plan setPlanActive(long id, SetPlanActiveRequest request) {
    var plan = findPlan(id);
    access.requireAgronomic(plan.farmId());
    if (request.active()) requireActiveProblem(plan.problemCode());
    int changed = queries.execute("""
      UPDATE phytosanitary_monitoring_plan SET active = ?, version = version + 1 WHERE id = ? AND version = ?
      """, request.active(), id, request.version());
    requirePlanChanged(changed);
    return findPlan(id);
  }

  public List<Alert> alerts(long farmId) {
    access.require(farmId, false);
    return queries.select(ALERT_SELECT + " WHERE f.farm_id = ? ORDER BY a.created_at DESC, a.id DESC",
      InspectionMonitoringService::alert, farmId);
  }

  @Transactional
  public Alert reviewAlert(long id, ReviewAlertRequest request) {
    var alert = findAlert(id);
    access.requireAgronomic(alert.farmId());
    int changed = queries.execute("""
      UPDATE phytosanitary_monitoring_alert
      SET review_notes = ?, reviewed_at = ?, reviewed_by_user_id = ?, version = version + 1
      WHERE id = ? AND version = ? AND reviewed_at IS NULL
      """, request.reviewNotes().trim(), Instant.now(), access.userId(), id, request.version());
    if (changed == 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "La alerta ya fue revisada o su versión cambió");
    }
    return findAlert(id);
  }

  @EventListener
  void recordThresholdAlert(InspectionService.Recorded event) {
    var inspection = event.inspection();
    queries.execute("""
      INSERT INTO phytosanitary_monitoring_alert (plan_id, inspection_id, incidence_percent, threshold_percent)
      SELECT id, ?, ?, incidence_threshold_percent FROM phytosanitary_monitoring_plan
      WHERE block_id = ? AND problem_code = ? AND active = TRUE AND start_date <= ?
        AND incidence_threshold_percent <= ?
      """, inspection.id(), inspection.incidencePercent(), inspection.blockId(), inspection.problemCode(),
      inspection.inspectedAt().atZone(ZoneOffset.UTC).toLocalDate(), inspection.incidencePercent());
  }

  private Plan findPlan(long id) {
    var today = LocalDate.now(ZoneOffset.UTC);
    return queries.select(PLAN_SELECT + " WHERE p.id = ?", row -> plan(row, today), id).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan de monitoreo no encontrado"));
  }

  private Alert findAlert(long id) {
    return queries.select(ALERT_SELECT + " WHERE a.id = ?", InspectionMonitoringService::alert, id).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alerta de monitoreo no encontrada"));
  }

  private void requireActiveProblem(String code) {
    if (queries.value("SELECT COUNT(*) FROM phytosanitary_problem WHERE code = ? AND active = TRUE", Long.class, code) == 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Problema sanitario desconocido o inactivo");
    }
  }

  private static void checkRange(LocalDate start, Double threshold) {
    if (start.getYear() < 1 || start.getYear() > 9999 || (threshold != null && !Double.isFinite(threshold))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha de inicio o el umbral no son válidos");
    }
  }

  private static void requirePlanChanged(int changed) {
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "El plan cambió; actualiza antes de editar");
  }

  private static Plan plan(JpaSql.Row row, LocalDate today) {
    var start = row.date("start_date");
    int interval = row.intValue("interval_days");
    var inspectedAt = row.instant("last_inspected_at");
    var lastInspectionDate = inspectedAt == null ? null : inspectedAt.atZone(ZoneOffset.UTC).toLocalDate();
    if (lastInspectionDate != null && lastInspectionDate.isBefore(start)) lastInspectionDate = null;
    var lastInspectionId = lastInspectionDate == null ? null : row.value("last_inspection_id", Long.class);
    boolean active = row.booleanValue("active");
    LocalDate nextDue = null;
    if (active) {
      long completedWindows = lastInspectionDate == null ? 0 : ChronoUnit.DAYS.between(start, lastInspectionDate) / interval + 1;
      nextDue = start.plusDays(completedWindows * interval);
    }
    return new Plan(row.longValue("id"), row.longValue("farm_id"), row.longValue("block_id"),
      row.text("problem_code"), start, interval, row.value("incidence_threshold_percent", Double.class),
      active, row.longValue("version"), nextDue, lastInspectionId, lastInspectionDate,
      nextDue != null && nextDue.isBefore(today));
  }

  private static Alert alert(JpaSql.Row row) {
    var reviewedAt = row.instant("reviewed_at");
    return new Alert(row.longValue("id"), row.longValue("plan_id"), row.longValue("inspection_id"),
      row.longValue("farm_id"), row.longValue("block_id"), row.text("problem_code"),
      row.doubleValue("incidence_percent"), row.doubleValue("threshold_percent"), row.instant("created_at"),
      reviewedAt == null ? AlertStatus.OPEN : AlertStatus.REVIEWED, row.text("review_notes"),
      row.value("reviewed_by_user_id", Long.class), reviewedAt, row.longValue("version"),
      row.instant("inspection_canceled_at"));
  }
}
