package com.yourco.agro.inspections;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.farm.FarmBusinessDate;
import com.yourco.agro.finances.FinanceDtos.Category;
import com.yourco.agro.finances.FinanceService;
import com.yourco.agro.inventory.InventoryDtos.ApplicationConsumption;
import com.yourco.agro.inventory.InventoryService;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;

@Service
public class InspectionService {
  private final JpaSql queries;
  private final FarmAccess access;
  private final ApplicationEventPublisher events;
  private final InventoryService inventory;
  private final FinanceService finance;
  private static final String TREATMENTS = """
    SELECT t.*, u.name AS author_name, m.quantity AS inventory_quantity, fu.id AS followup_id
    FROM inspection_treatment t JOIN app_user u ON u.id = t.created_by_user_id
    LEFT JOIN inventory_movement m ON m.id = t.inventory_movement_id
    LEFT JOIN inspection_treatment_followup fu ON fu.treatment_id = t.id
    """;
  private static final String SELECT = """
    SELECT i.*, f.farm_id, p.name AS problem_name, u.name AS inspector_name
    FROM phytosanitary_inspection i JOIN block b ON b.id = i.block_id
    JOIN field f ON f.id = b.field_id JOIN phytosanitary_problem p ON p.code = i.problem_code
    JOIN app_user u ON u.id = i.created_by_user_id
    """;
  private static final Function<JpaSql.Row, InspectionDtos.Inspection> MAPPER = result -> {
    var reviewedAt = result.instant("reviewed_at");
    var canceledAt = result.instant("canceled_at");
    int inspected = result.intValue("inspected_plants");
    int affected = result.intValue("affected_plants");
    return new InspectionDtos.Inspection(result.longValue("id"), result.longValue("farm_id"),
      result.longValue("block_id"), result.value("row_id", Long.class), result.text("problem_code"),
      result.text("problem_name"), result.instant("inspected_at"), inspected,
      affected, result.value("affected_area_ha", Double.class), 100.0 * affected / inspected, result.text("symptoms"),
      result.doubleValue("severity_percent"), result.text("severity_method"),
      InspectionDtos.AssessmentStatus.valueOf(result.text("assessment_status")),
      result.booleanValue("resolved"), result.date("next_visit"),
      result.longValue("created_by_user_id"), result.text("inspector_name"),
      result.value("reviewed_by_user_id", Long.class), result.text("review_notes"),
      reviewedAt, result.longValue("version"),
      canceledAt, result.value("canceled_by_user_id", Long.class),
      result.text("cancellation_reason"), result.value("parent_inspection_id", Long.class));
  };

  public InspectionService(JpaSql queries, FarmAccess access, ApplicationEventPublisher events,
                           InventoryService inventory, FinanceService finance) {
    this.queries = queries;
    this.access = access;
    this.events = events;
    this.inventory = inventory;
    this.finance = finance;
  }

  record Recorded(InspectionDtos.Inspection inspection) {}

  public List<InspectionDtos.Problem> problems(Long farmId, boolean includeInactive) {
    if (farmId == null) throw badRequest("La finca es obligatoria");
    access.require(farmId, false);
    String sql = "SELECT code, name, category, active FROM phytosanitary_problem";
    if (!includeInactive) sql += " WHERE active = TRUE";
    sql += " ORDER BY active DESC, name, code";
    return queries.select(sql, result -> new InspectionDtos.Problem(result.text("code"),
      result.text("name"), result.text("category"), result.booleanValue("active")));
  }

  @Transactional
  public InspectionDtos.Problem createProblem(InspectionDtos.CreateProblemRequest request) {
    access.requireAgronomic(request.farmId());
    String code = normalizeCode(request.code());
    String category = normalizeCategory(request.category());
    if (queries.value("SELECT COUNT(*) FROM phytosanitary_problem WHERE code = ?", Integer.class, code) > 0) {
      throw conflict("Ya existe una plaga o enfermedad con ese código");
    }
    queries.execute("INSERT INTO phytosanitary_problem(code, name, category, active) VALUES (?, ?, ?, TRUE)",
      code, request.name().trim(), category);
    return problem(code);
  }

  @Transactional
  public InspectionDtos.Problem updateProblem(String code, InspectionDtos.UpdateProblemRequest request) {
    access.requireAgronomic(request.farmId());
    String normalized = normalizeCode(code);
    String category = normalizeCategory(request.category());
    if (queries.value("SELECT COUNT(*) FROM phytosanitary_problem WHERE code = ?", Integer.class, normalized) == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Problema sanitario no encontrado");
    }
    queries.execute("UPDATE phytosanitary_problem SET name = ?, category = ?, active = ? WHERE code = ?",
      request.name().trim(), category, request.active(), normalized);
    return problem(normalized);
  }

  @Transactional
  public InspectionDtos.Problem deactivateProblem(String code, long farmId) {
    access.requireAgronomic(farmId);
    String normalized = normalizeCode(code);
    if (queries.execute("UPDATE phytosanitary_problem SET active = FALSE WHERE code = ?", normalized) == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Problema sanitario no encontrado");
    }
    return problem(normalized);
  }

  private InspectionDtos.Problem problem(String code) {
    return queries.select("SELECT code, name, category, active FROM phytosanitary_problem WHERE code = ?",
      result -> new InspectionDtos.Problem(result.text("code"), result.text("name"),
        result.text("category"), result.booleanValue("active")), code).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Problema sanitario no encontrado"));
  }

  @Transactional
  public InspectionDtos.Inspection create(InspectionDtos.CreateRequest request) {
    access.require(access.blockFarm(request.blockId()), false);
    String problemCode = normalizeCode(request.problemCode());
    if (request.rowId() != null) {
      access.require(access.rowFarm(request.rowId()), false);
      if (!request.blockId().equals(queries.value("SELECT block_id FROM row_line WHERE id = ?", Long.class, request.rowId()))) {
        throw badRequest("El surco debe pertenecer al bloque seleccionado");
      }
    }
    if (request.affectedPlants() > request.inspectedPlants()) throw badRequest("Las plantas afectadas no pueden superar las inspeccionadas");
    if (request.affectedAreaHa() == null || request.affectedAreaHa() < 0) throw badRequest("El área afectada no puede ser negativa");
    if (request.affectedPlants() == 0 && request.affectedAreaHa() != 0) throw badRequest("Sin plantas afectadas el área afectada debe ser cero");
    var blockArea = queries.value("SELECT area_ha FROM block WHERE id = ?", Double.class, request.blockId());
    if (blockArea != null && request.affectedAreaHa() > blockArea) throw badRequest("El área afectada no puede superar el área del bloque");
    if (request.affectedPlants() == 0 && request.severityPercent() != 0) throw badRequest("Sin plantas afectadas la severidad debe ser cero");
    if (request.nextVisit().isBefore(request.inspectedAt().atZone(ZoneOffset.UTC).toLocalDate())) throw badRequest("La próxima visita no puede ser anterior a la inspección");
    if (queries.value("SELECT COUNT(*) FROM phytosanitary_problem WHERE code = ? AND active = TRUE", Integer.class, problemCode) == 0) throw badRequest("Problema sanitario desconocido o inactivo");
    if (request.parentInspectionId() != null) {
      var parent = writable(request.parentInspectionId());
      if (!parent.blockId().equals(request.blockId()) || !Objects.equals(parent.rowId(), request.rowId())
        || !parent.problemCode().equals(problemCode) || request.inspectedAt().isBefore(parent.inspectedAt())) {
        throw badRequest("El seguimiento debe corresponder al mismo problema y ubicación, con fecha posterior");
      }
    }
    long id = queries.insert("""
      INSERT INTO phytosanitary_inspection (block_id, row_id, problem_code, inspected_at, inspected_plants,
        affected_plants, affected_area_ha, symptoms, severity_percent, severity_method, next_visit,
        created_by_user_id, parent_inspection_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """, request.blockId(), request.rowId(), problemCode, request.inspectedAt(), request.inspectedPlants(),
      request.affectedPlants(), request.affectedAreaHa(), request.symptoms(), request.severityPercent(),
      request.severityMethod(), request.nextVisit(), access.userId(), request.parentInspectionId());
    var inspection = get(id);
    events.publishEvent(new Recorded(inspection));
    return inspection;
  }

  public InspectionDtos.Inspection get(Long id) {
    var inspection = queries.select(SELECT + " WHERE i.id = ?", MAPPER, id).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inspección no encontrada"));
    access.require(inspection.farmId(), false);
    return inspection;
  }

  public List<InspectionDtos.Inspection> list(Long farmId, Long blockId, String problemCode, Instant from, Instant to) {
    if (farmId != null) access.require(farmId, false);
    if (blockId != null) access.require(access.blockFarm(blockId), false);
    if (from != null && to != null && from.isAfter(to)) throw badRequest("El rango de fechas no es válido");
    var farmIds = farmId == null ? access.farmIds() : List.of(farmId);
    var sql = new StringBuilder(SELECT + " WHERE f.farm_id = ?");
    var filters = new ArrayList<Object>();
    if (blockId != null) { sql.append(" AND i.block_id = ?"); filters.add(blockId); }
    if (problemCode != null) { sql.append(" AND i.problem_code = ?"); filters.add(problemCode); }
    if (from != null) { sql.append(" AND i.inspected_at >= ?"); filters.add(from); }
    if (to != null) { sql.append(" AND i.inspected_at <= ?"); filters.add(to); }
    sql.append(" ORDER BY i.inspected_at DESC, i.id DESC");
    return farmIds.stream().flatMap(id -> {
      var parameters = new ArrayList<Object>(); parameters.add(id); parameters.addAll(filters);
      return queries.select(sql.toString(), MAPPER, parameters.toArray()).stream();
    }).sorted(Comparator.comparing(InspectionDtos.Inspection::inspectedAt).reversed()).toList();
  }

  @Transactional
  public InspectionDtos.Inspection review(Long id, InspectionDtos.ReviewRequest request) {
    var inspection = writable(id);
    access.requireAgronomic(inspection.farmId());
    if (inspection.affectedPlants() == 0 && request.assessmentStatus() == InspectionDtos.AssessmentStatus.CONFIRMED) throw badRequest("No se puede confirmar una afectación sin plantas afectadas");
    int changed = queries.execute("""
      UPDATE phytosanitary_inspection SET assessment_status = ?, resolved = ?, review_notes = ?,
        reviewed_by_user_id = ?, reviewed_at = ?, version = version + 1 WHERE id = ? AND version = ?
      """, request.assessmentStatus().name(), request.resolved(), request.reviewNotes(), access.userId(),
      Instant.now(), id, request.version());
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "La inspección cambió; actualiza antes de revisar");
    return get(id);
  }

  public String healthStatus(Long blockId, LocalDate today) {
    var inspections = list(null, blockId, null, null, null);
    var latestByTarget = new LinkedHashMap<String, InspectionDtos.Inspection>();
    for (var inspection : inspections) {
      if (inspection.canceledAt() == null) latestByTarget.putIfAbsent(inspection.problemCode() + ":" + inspection.rowId(), inspection);
    }
    var recent = latestByTarget.values().stream()
      .filter(inspection -> !inspection.inspectedAt().isBefore(today.minusDays(30).atStartOfDay(ZoneOffset.UTC).toInstant())
        && !inspection.nextVisit().isBefore(today)).toList();
    if (recent.isEmpty()) return "NO_RECENT_INSPECTION";
    if (recent.stream().anyMatch(inspection -> !inspection.resolved() && inspection.affectedPlants() > 0
      && inspection.assessmentStatus() != InspectionDtos.AssessmentStatus.DISCARDED)) return "ACTIVE_FINDINGS";
    if (latestByTarget.values().stream().anyMatch(inspection -> !inspection.resolved() && inspection.affectedPlants() > 0
      && inspection.assessmentStatus() != InspectionDtos.AssessmentStatus.DISCARDED && !recent.contains(inspection))) return "NO_RECENT_INSPECTION";
    return "NO_ACTIVE_FINDINGS";
  }

  private static ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }

  private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }

  static String normalizeCode(String value) {
    String normalized = value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    if (normalized.isBlank() || normalized.length() > 40) throw badRequest("El código no es válido");
    return normalized;
  }

  private String normalizeCategory(String value) {
    String normalized = value.trim().toUpperCase(Locale.ROOT);
    if (!Set.of("DISEASE", "PEST").contains(normalized)) throw badRequest("La categoría debe ser DISEASE o PEST");
    return normalized;
  }

  InspectionDtos.Inspection lockedInspection(Long id) {
    get(id);
    queries.value("SELECT id FROM phytosanitary_inspection WHERE id = ? FOR UPDATE", Long.class, id);
    return get(id);
  }

  void requireWritable(InspectionDtos.Inspection inspection) {
    if (inspection.canceledAt() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "La inspección está anulada");
  }

  InspectionDtos.Inspection writable(Long id) {
    var inspection = lockedInspection(id);
    requireWritable(inspection);
    return inspection;
  }

  @Transactional
  public InspectionDtos.Inspection cancel(Long id, InspectionDtos.CancelRequest request) {
    var inspection = writable(id);
    access.requireAgronomic(inspection.farmId());
    int changed = queries.execute("""
      UPDATE phytosanitary_inspection SET canceled_at = ?, canceled_by_user_id = ?, cancellation_reason = ?,
      version = version + 1 WHERE id = ? AND version = ? AND canceled_at IS NULL
      """, Instant.now(), access.userId(), request.reason().trim(), id, request.version());
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "La inspección cambió; actualiza antes de anular");
    return get(id);
  }

  public List<InspectionDtos.Treatment> treatments(Long id) {
    get(id);
    return queries.select(TREATMENTS + " WHERE t.inspection_id = ? ORDER BY t.occurred_at DESC, t.id DESC",
      InspectionService::treatment, id);
  }

  @Transactional
  public InspectionDtos.Treatment addTreatment(Long id, InspectionDtos.TreatmentRequest request) {
    var inspection = lockedInspection(id);
    var previous = replayedTreatment(id, request, null);
    return previous != null ? previous : createTreatment(inspection, request, null, null);
  }

  InspectionDtos.Treatment replayedTreatment(long inspectionId, InspectionDtos.TreatmentRequest request, Long followupId) {
    if (request.operationId() == null) return null;
    var result = queries.select(TREATMENTS + " WHERE t.inspection_id = ? AND t.operation_id = ?", row -> row,
      inspectionId, request.operationId()).stream().findFirst();
    if (result.isEmpty()) return null;
    var row = result.get();
    var saved = treatment(row);
    if (!Objects.equals(row.value("followup_id", Long.class), followupId) || saved.createdByUserId() != access.userId().longValue()
        || !saved.occurredAt().equals(request.occurredAt().truncatedTo(ChronoUnit.MICROS))
        || !saved.description().equals(request.description().strip()) || !Objects.equals(saved.inventoryLotId(), request.inventoryLotId())
        || !sameQuantity(saved.quantity(), request.quantity()) || hasText(request.product()) || hasText(request.unit())) {
      throw conflict("El identificador de operación ya corresponde a otro tratamiento");
    }
    return saved;
  }

  InspectionDtos.Treatment createTreatment(InspectionDtos.Inspection inspection, InspectionDtos.TreatmentRequest request,
                                          Long followupId, Long expectedProductId) {
    requireWritable(inspection);
    Instant occurredAt = request.occurredAt().truncatedTo(ChronoUnit.MICROS);
    if (request.occurredAt().isBefore(inspection.inspectedAt())) throw badRequest("El tratamiento no puede ser anterior a la inspección");
    if (request.inventoryLotId() == null && (hasText(request.product()) || hasText(request.unit()) || request.quantity() != null)) {
      throw badRequest("Selecciona un lote de inventario para registrar un producto aplicado");
    }
    if (hasText(request.product()) || hasText(request.unit())) throw badRequest("El producto y la unidad se obtienen del lote de inventario");
    LocalDate appliedOn = FarmBusinessDate.from(occurredAt);
    ApplicationConsumption consumption = null;
    if (request.inventoryLotId() != null) {
      if (request.quantity() == null || request.operationId() == null) throw badRequest("Indica la cantidad aplicada y el identificador de operación");
      String reference = "Tratamiento de inspección #" + inspection.id();
      if (followupId != null) reference += " · Orden #" + followupId;
      consumption = inventory.consumeForApplication(inspection.farmId(), request.inventoryLotId(), request.operationId(),
        request.quantity(), expectedProductId, appliedOn, reference);
      if (consumption.costCop() == null) throw badRequest("Registra el costo unitario del lote antes de aplicar el producto");
    }
    long treatmentId = queries.insert("""
      INSERT INTO inspection_treatment (inspection_id, occurred_at, description, product, quantity, unit, created_by_user_id, operation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      """, inspection.id(), occurredAt, request.description().strip(), consumption == null ? null : consumption.productName(),
      request.quantity(), consumption == null ? null : consumption.unit(), access.userId(), request.operationId());
    if (consumption != null) {
      long expenseId = finance.recordApplicationExpense(inspection.farmId(), inspection.blockId(), request.operationId(), appliedOn,
        Category.PHYTOSANITARY, consumption.costCop(), "Tratamiento #" + treatmentId + " · " + consumption.productName(),
        "PHYTOSANITARY_TREATMENT", treatmentId);
      queries.execute("""
        UPDATE inspection_treatment SET inventory_lot_id = ?, inventory_lot_code = ?, inventory_movement_id = ?, financial_entry_id = ?
        WHERE id = ?
        """, request.inventoryLotId(), consumption.lotCode(), consumption.movementId(), expenseId, treatmentId);
    }
    return queries.selectOne(TREATMENTS + " WHERE t.id = ?", InspectionService::treatment, treatmentId);
  }

  static BigDecimal treatmentQuantity(JpaSql.Row row) {
    BigDecimal consumed = row.value("inventory_quantity", BigDecimal.class);
    return consumed == null ? row.value("quantity", BigDecimal.class) : consumed;
  }

  private static InspectionDtos.Treatment treatment(JpaSql.Row row) {
    return new InspectionDtos.Treatment(row.longValue("id"), row.longValue("inspection_id"), row.instant("occurred_at"),
      row.text("description"), row.text("product"), treatmentQuantity(row), row.text("unit"), row.longValue("created_by_user_id"),
      row.text("author_name"), row.value("inventory_lot_id", Long.class), row.text("inventory_lot_code"),
      row.value("inventory_movement_id", Long.class));
  }

  private static boolean sameQuantity(BigDecimal saved, BigDecimal request) {
    return saved == null ? request == null : request != null && saved.compareTo(request) == 0;
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  public List<InspectionDtos.Evidence> evidence(Long id) {
    get(id);
    return queries.select("""
      SELECT e.*, u.name AS author_name FROM inspection_evidence e JOIN app_user u ON u.id = e.created_by_user_id
      WHERE e.inspection_id = ? ORDER BY e.created_at DESC, e.id DESC
      """, result -> new InspectionDtos.Evidence(result.longValue("id"), result.longValue("inspection_id"),
      result.value("treatment_id", Long.class), InspectionDtos.EvidenceKind.valueOf(result.text("kind")),
      result.text("s3_key"), result.text("content_type"), result.longValue("created_by_user_id"),
      result.text("author_name"), result.instant("created_at")), id);
  }

  @Transactional
  public InspectionDtos.Evidence addEvidence(Long id, InspectionDtos.EvidenceRequest request) {
    writable(id);
    if (request.treatmentId() != null && treatments(id).stream().noneMatch(treatment -> treatment.id().equals(request.treatmentId()))) {
      throw badRequest("El tratamiento debe pertenecer a esta inspección");
    }
    long evidenceId = queries.insert("""
      INSERT INTO inspection_evidence (inspection_id, treatment_id, kind, s3_key, content_type, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
      """, id, request.treatmentId(), request.kind().name(), request.s3Key().trim(), request.contentType(), access.userId());
    return evidence(id).stream().filter(item -> item.id().equals(evidenceId)).findFirst().orElseThrow();
  }

}
