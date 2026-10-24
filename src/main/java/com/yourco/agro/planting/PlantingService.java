package com.yourco.agro.planting;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.catalog.CropCatalogService;
import com.yourco.agro.tasks.TaskDtos;
import com.yourco.agro.tasks.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.*;

import static com.yourco.agro.planting.PlantingDtos.*;

@Service
public class PlantingService {
  private final JdbcTemplate jdbc;
  private final FarmAccess access;
  private final CropCatalogService catalog;
  private final PlantingCalendarService calendars;
  private final TaskService tasks;

  public PlantingService(JdbcTemplate jdbc, FarmAccess access, CropCatalogService catalog,
                         PlantingCalendarService calendars, TaskService tasks) {
    this.jdbc = jdbc;
    this.access = access;
    this.catalog = catalog;
    this.calendars = calendars;
    this.tasks = tasks;
  }

  private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
  private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }

  private long insert(String sql, Object... values) {
    var key = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      var statement = connection.prepareStatement(sql, new String[]{"id"});
      for (int index = 0; index < values.length; index++) statement.setObject(index + 1, values[index]);
      return statement;
    }, key);
    return Objects.requireNonNull(key.getKey()).longValue();
  }

  private Map<String, Object> row(String table, long id) {
    var rows = jdbc.queryForList("SELECT * FROM " + table + " WHERE id=?", id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Registro no encontrado");
    return rows.get(0);
  }

  private long number(Map<String, Object> values, String key) { return ((Number) values.get(key)).longValue(); }

  private Map<String, Object> cycle(long id, boolean manage, boolean lock) {
    var cycle = row("crop_cycle", id);
    long farmId = access.blockFarm(number(cycle, "block_id"));
    if (manage) access.requireAgronomic(farmId); else access.require(farmId, false);
    if (lock) return jdbc.queryForMap("SELECT * FROM crop_cycle WHERE id=? FOR UPDATE", id);
    return cycle;
  }

  private Map<String, Object> plan(long id, boolean manage, boolean lock) {
    var plan = row("planting_plan", id);
    var cycle = row("crop_cycle", number(plan, "cycle_id"));
    long farmId = access.blockFarm(number(cycle, "block_id"));
    if (manage) access.requireAgronomic(farmId); else access.require(farmId, false);
    if (lock) return jdbc.queryForMap("SELECT * FROM planting_plan WHERE id=? FOR UPDATE", id);
    return plan;
  }

  private Map<String, Object> presentCycle(Map<String, Object> source) {
    var result = new LinkedHashMap<String, Object>();
    result.put("id", source.get("id"));
    result.put("blockId", source.get("block_id"));
    result.put("rowId", source.get("row_id"));
    result.put("cropId", source.get("crop_catalog_id"));
    result.put("varietyId", source.get("variety_id"));
    result.put("code", source.get("code"));
    result.put("crop", source.get("crop"));
    result.put("variety", source.get("variety"));
    result.put("status", source.get("status"));
    result.put("currentStage", source.get("current_stage"));
    result.put("plannedPlantingFrom", source.get("planned_planting_from"));
    result.put("plannedPlantingTo", source.get("planned_planting_to"));
    result.put("plantedOn", source.get("planted_on"));
    result.put("expectedHarvestOn", source.get("expected_harvest_on"));
    result.put("closedOn", source.get("closed_on"));
    result.put("notes", source.get("notes"));
    result.put("version", source.get("version"));
    result.put("siteAssessment", jdbc.queryForList("SELECT * FROM crop_cycle_site_assessment WHERE cycle_id=?", source.get("id"))
      .stream().findFirst().orElse(null));
    result.put("stageHistory", jdbc.queryForList("SELECT id,stage,observed_on AS \"observedOn\",notes,created_by AS \"createdBy\" FROM crop_cycle_stage_history WHERE cycle_id=? ORDER BY observed_on DESC,id DESC", source.get("id")));
    result.put("establishmentChecks", jdbc.queryForList("SELECT id,checked_on AS \"checkedOn\",plants_checked AS \"plantsChecked\",surviving_plants AS \"survivingPlants\",dead_plants AS \"deadPlants\",replaced_plants AS \"replacedPlants\",uniformity,causes,notes,created_by AS \"createdBy\" FROM planting_establishment_check WHERE cycle_id=? ORDER BY checked_on DESC,id DESC", source.get("id")));
    result.put("plans", jdbc.queryForList("SELECT id,material_lot_id AS \"materialLotId\",planned_area_ha AS \"plannedAreaHa\",planting_system AS \"plantingSystem\",target_density_ha AS \"targetDensityHa\",target_plants AS \"targetPlants\",window_from AS \"windowFrom\",window_to AS \"windowTo\",responsible_id AS \"responsibleId\",status,task_id AS \"taskId\",version FROM planting_plan WHERE cycle_id=? ORDER BY id DESC", source.get("id")));
    return result;
  }

  private Map<String, Object> presentMaterial(Map<String, Object> source) {
    var result = new LinkedHashMap<String, Object>();
    result.put("id", source.get("id"));
    result.put("farmId", source.get("farm_id"));
    result.put("cycleId", source.get("cycle_id"));
    result.put("cropId", source.get("crop_catalog_id"));
    result.put("varietyId", source.get("variety_id"));
    result.put("materialType", source.get("material_type"));
    result.put("crop", source.get("crop"));
    result.put("variety", source.get("variety"));
    result.put("supplier", source.get("supplier"));
    result.put("sourceReference", source.get("source_reference"));
    result.put("certificationReference", source.get("certification_reference"));
    result.put("quantityReceived", source.get("quantity_received"));
    result.put("quantityAccepted", source.get("quantity_accepted"));
    result.put("quantityRejected", source.get("quantity_rejected"));
    result.put("healthInspection", source.get("health_inspection"));
    result.put("status", source.get("status"));
    result.put("version", source.get("version"));
    result.put("decisionReason", source.get("decision_reason"));
    return result;
  }

  private Map<String, Object> presentPlan(Map<String, Object> source) {
    var result = new LinkedHashMap<String, Object>();
    result.put("id", source.get("id"));
    result.put("cycleId", source.get("cycle_id"));
    result.put("materialLotId", source.get("material_lot_id"));
    result.put("plannedAreaHa", source.get("planned_area_ha"));
    result.put("plantingSystem", source.get("planting_system"));
    result.put("rowSpacingM", source.get("row_spacing_m"));
    result.put("plantSpacingM", source.get("plant_spacing_m"));
    result.put("targetDensityHa", source.get("target_density_ha"));
    result.put("targetPlants", source.get("target_plants"));
    result.put("windowFrom", source.get("window_from"));
    result.put("windowTo", source.get("window_to"));
    result.put("responsibleId", source.get("responsible_id"));
    result.put("technicalBasis", source.get("technical_basis"));
    result.put("status", source.get("status"));
    result.put("taskId", source.get("task_id"));
    result.put("version", source.get("version"));
    return result;
  }

  private Map<String, Object> presentExecution(Map<String, Object> source) {
    var result = new LinkedHashMap<String, Object>();
    result.put("id", source.get("id"));
    result.put("planId", source.get("plan_id"));
    result.put("eventId", source.get("event_id"));
    result.put("cycleId", source.get("cycle_id"));
    result.put("executedOn", source.get("executed_on"));
    result.put("areaHa", source.get("area_ha"));
    result.put("plantsPlanted", source.get("plants_planted"));
    result.put("plantsRejected", source.get("plants_rejected"));
    result.put("locationDetails", source.get("location_details"));
    result.put("operatorNotes", source.get("operator_notes"));
    return result;
  }

  public Map<String, Object> list(long farmId) {
    access.require(farmId, false);
    var cycles = jdbc.queryForList("SELECT c.* FROM crop_cycle c JOIN block b ON b.id=c.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY c.id DESC", farmId)
      .stream().map(this::presentCycle).toList();
    var materials = jdbc.queryForList("SELECT * FROM planting_material_lot WHERE farm_id=? ORDER BY id DESC", farmId)
      .stream().map(this::presentMaterial).toList();
    var plans = jdbc.queryForList("SELECT p.*,c.code AS cycle_code FROM planting_plan p JOIN crop_cycle c ON c.id=p.cycle_id JOIN block b ON b.id=c.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY p.id DESC", farmId)
      .stream().map(this::presentPlan).toList();
    var executions = jdbc.queryForList("SELECT e.*,p.cycle_id FROM planting_execution e JOIN planting_plan p ON p.id=e.plan_id JOIN crop_cycle c ON c.id=p.cycle_id JOIN block b ON b.id=c.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY e.executed_on DESC,e.id DESC", farmId)
      .stream().map(this::presentExecution).toList();
    return Map.of("cycles", cycles, "materialLots", materials, "plans", plans, "executions", executions);
  }

  @Transactional
  public Map<String, Object> createCycle(CycleRequest request) {
    long farmId = access.blockFarm(request.blockId());
    access.require(farmId, false);
    if (request.plannedPlantingTo().isBefore(request.plannedPlantingFrom())) throw bad("La ventana de siembra es inválida");
    if (request.rowId() != null && access.rowFarm(request.rowId()) != farmId) throw bad("La hilera no pertenece a la finca");
    if (request.rowId() != null && jdbc.queryForObject("SELECT block_id FROM row_line WHERE id=?", Long.class, request.rowId()) != request.blockId()) throw bad("La hilera no pertenece al bloque");
    var selection = catalog.resolve(farmId, request.cropId(), request.varietyId());
    Long cropId = selection == null ? null : selection.cropId();
    Long varietyId = selection == null ? null : selection.varietyId();
    String crop = selection == null ? request.crop().trim() : selection.crop();
    String variety = selection == null ? request.variety() : selection.variety();
    calendars.validateCycleWindow(farmId, cropId, varietyId, request.plannedPlantingFrom(), request.plannedPlantingTo());
    long id = insert("INSERT INTO crop_cycle(block_id,row_id,crop_catalog_id,variety_id,code,crop,variety,planned_planting_from,planned_planting_to,expected_harvest_on,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", request.blockId(), request.rowId(), cropId, varietyId, request.code().trim(), crop, variety, request.plannedPlantingFrom(), request.plannedPlantingTo(), request.expectedHarvestOn(), request.notes(), access.userId());
    jdbc.update("INSERT INTO crop_cycle_stage_history(cycle_id,stage,observed_on,notes,created_by) VALUES (?,?,?,?,?)", id, Stage.PLANNED.name(), request.plannedPlantingFrom(), "Ciclo creado", access.userId());
    return presentCycle(cycle(id, false, false));
  }

  @Transactional
  public Map<String, Object> createSiteAssessment(long cycleId, SiteAssessmentRequest request) {
    var cycle = cycle(cycleId, false, true);
    if (jdbc.queryForObject("SELECT COUNT(*) FROM crop_cycle_site_assessment WHERE cycle_id=?", Integer.class, cycleId) > 0) throw conflict("El ciclo ya tiene evaluación de lote");
    if (request.soilAnalysisId() != null) {
      var analysis = row("soil_analysis", request.soilAnalysisId());
      if (number(analysis, "block_id") != number(cycle, "block_id")) throw bad("El análisis de suelo debe pertenecer al mismo bloque");
    }
    long id = insert("INSERT INTO crop_cycle_site_assessment(cycle_id,previous_use,neighboring_uses,soil_analysis_id,slope,drainage,flooding_risk,wind_risk,contamination_risk,phytosanitary_risk,environmental_restrictions,evidence_notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", cycleId, request.previousUse(), request.neighboringUses(), request.soilAnalysisId(), request.slope(), request.drainage(), request.floodingRisk(), request.windRisk(), request.contaminationRisk(), request.phytosanitaryRisk(), request.environmentalRestrictions(), request.evidenceNotes(), access.userId());
    return row("crop_cycle_site_assessment", id);
  }

  @Transactional
  public Map<String, Object> decideSite(long cycleId, Decision request, boolean approve) {
    var cycle = cycle(cycleId, true, true);
    var assessment = jdbc.queryForMap("SELECT * FROM crop_cycle_site_assessment WHERE cycle_id=? FOR UPDATE", cycleId);
    if (number(assessment, "version") != request.version() || !"DRAFT".equals(assessment.get("status"))) throw conflict("La evaluación cambió o ya fue decidida");
    jdbc.update("UPDATE crop_cycle_site_assessment SET status=?,version=version+1,approved_by=?,approved_at=CURRENT_TIMESTAMP,decision_reason=? WHERE id=?", approve ? "APPROVED" : "REJECTED", access.userId(), request.reason(), assessment.get("id"));
    return presentCycle(cycle(cycleId, false, false));
  }

  @Transactional
  public Map<String, Object> createMaterialLot(MaterialLotRequest request) {
    access.require(request.farmId(), false);
    if (request.cycleId() != null && access.blockFarm(number(row("crop_cycle", request.cycleId()), "block_id")) != request.farmId()) throw bad("El ciclo no pertenece a la finca");
    var selection = catalog.resolve(request.farmId(), request.cropId(), request.varietyId());
    Long cropId = selection == null ? null : selection.cropId();
    Long varietyId = selection == null ? null : selection.varietyId();
    String crop = selection == null ? request.crop().trim() : selection.crop();
    String variety = selection == null ? request.variety().trim() : selection.variety();
    long id = insert("INSERT INTO planting_material_lot(farm_id,cycle_id,crop_catalog_id,variety_id,material_type,crop,variety,supplier,source_reference,certification_reference,quantity_received,health_inspection,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", request.farmId(), request.cycleId(), cropId, varietyId, request.materialType().name(), crop, variety, request.supplier().trim(), request.sourceReference().trim(), request.certificationReference(), request.quantityReceived(), request.healthInspection().trim(), access.userId());
    return presentMaterial(row("planting_material_lot", id));
  }

  @Transactional
  public Map<String, Object> decideMaterial(long id, MaterialDecision request) {
    var material = row("planting_material_lot", id);
    access.requireAgronomic(number(material, "farm_id"));
    if (number(material, "version") != request.version() || !"RECEIVED".equals(material.get("status"))) throw conflict("El lote vegetal cambió o ya fue decidido");
    BigDecimal accepted = request.quantityAccepted() == null ? BigDecimal.ZERO : request.quantityAccepted();
    BigDecimal rejected = request.quantityRejected() == null ? BigDecimal.ZERO : request.quantityRejected();
    if (accepted.add(rejected).compareTo((BigDecimal) material.get("quantity_received")) > 0) throw bad("La cantidad aceptada y rechazada supera la recibida");
    if (request.status() == MaterialStatus.ACCEPTED && accepted.signum() == 0) throw bad("Un lote aceptado debe tener cantidad aceptada");
    jdbc.update("UPDATE planting_material_lot SET status=?,quantity_accepted=?,quantity_rejected=?,version=version+1,decided_by=?,decided_at=CURRENT_TIMESTAMP,decision_reason=? WHERE id=?", request.status().name(), accepted, rejected, access.userId(), request.reason(), id);
    return presentMaterial(row("planting_material_lot", id));
  }

  @Transactional
  public Map<String, Object> createPlan(PlanRequest request) {
    var cycle = cycle(request.cycleId(), true, true);
    if (Set.of("CLOSED", "CANCELED").contains(cycle.get("status"))) throw bad("No se puede planear un ciclo cerrado o cancelado");
    if (request.windowTo().isBefore(request.windowFrom())) throw bad("La ventana del plan es inválida");
    var assessment = jdbc.queryForList("SELECT status FROM crop_cycle_site_assessment WHERE cycle_id=?", request.cycleId());
    if (assessment.isEmpty() || !"APPROVED".equals(assessment.get(0).get("status"))) throw bad("Aprueba primero la evaluación del lote");
    var material = row("planting_material_lot", request.materialLotId());
    if (number(material, "farm_id") != access.blockFarm(number(cycle, "block_id")) || !"ACCEPTED".equals(material.get("status"))) throw bad("El lote vegetal debe estar aceptado y pertenecer a la finca");
    if (material.get("cycle_id") != null && number(material, "cycle_id") != request.cycleId()) throw bad("El lote vegetal está asociado a otro ciclo");
    if (jdbc.queryForObject("SELECT COUNT(*) FROM farm_membership WHERE farm_id=? AND user_id=?", Integer.class, access.blockFarm(number(cycle, "block_id")), request.responsibleId()) != 1) throw bad("El responsable debe pertenecer a la finca");
    Double blockArea = jdbc.queryForObject("SELECT area_ha FROM block WHERE id=?", Double.class, number(cycle, "block_id"));
    if (blockArea != null && request.plannedAreaHa().compareTo(BigDecimal.valueOf(blockArea)) > 0) throw bad("El área planificada supera el bloque");
    long id = insert("INSERT INTO planting_plan(cycle_id,material_lot_id,planned_area_ha,planting_system,row_spacing_m,plant_spacing_m,target_density_ha,target_plants,window_from,window_to,responsible_id,technical_basis,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", request.cycleId(), request.materialLotId(), request.plannedAreaHa(), request.plantingSystem().trim(), request.rowSpacingM(), request.plantSpacingM(), request.targetDensityHa(), request.targetPlants(), request.windowFrom(), request.windowTo(), request.responsibleId(), request.technicalBasis().trim(), access.userId());
    return row("planting_plan", id);
  }

  @Transactional
  public Map<String, Object> decidePlan(long id, Decision request, boolean approve) {
    var current = plan(id, true, true);
    if (number(current, "version") != request.version() || !"DRAFT".equals(current.get("status"))) throw conflict("El plan cambió o ya fue decidido");
    if (approve) {
      var cycle = row("crop_cycle", number(current, "cycle_id"));
      var assessment = jdbc.queryForList("SELECT status FROM crop_cycle_site_assessment WHERE cycle_id=?", current.get("cycle_id"));
      if (assessment.isEmpty() || !"APPROVED".equals(assessment.get(0).get("status"))) throw bad("Aprueba la evaluación del lote antes del plan");
      jdbc.update("UPDATE planting_plan SET status='APPROVED',version=version+1,approved_by=?,approved_at=CURRENT_TIMESTAMP,decision_reason=? WHERE id=?", access.userId(), request.reason(), id);
      jdbc.update("UPDATE crop_cycle SET status='PLANNED',version=version+1 WHERE id=? AND status='DRAFT'", cycle.get("id"));
    } else {
      jdbc.update("UPDATE planting_plan SET status='CANCELED',version=version+1,canceled_by=?,canceled_at=CURRENT_TIMESTAMP,decision_reason=? WHERE id=?", access.userId(), request.reason(), id);
    }
    return plan(id, false, false);
  }

  @Transactional
  public Map<String, Object> createTask(long id) {
    var current = plan(id, true, true);
    if (!"APPROVED".equals(current.get("status"))) throw bad("Aprueba el plan antes de generar tareas");
    if (current.get("task_id") == null) {
      var cycle = row("crop_cycle", number(current, "cycle_id"));
      var task = tasks.create(new TaskDtos.CreateRequest(access.blockFarm(number(cycle, "block_id")), null, number(cycle, "block_id"), number(current, "responsible_id"), "Siembra " + cycle.get("code"), TaskDtos.Activity.planting, ((java.sql.Date) current.get("window_from")).toLocalDate(), LocalTime.of(7, 0), TaskDtos.Priority.Media, "Ejecutar plan de siembra #" + id + ". Registrar plantas sembradas, rechazadas, ubicación y evidencias."));
      jdbc.update("UPDATE planting_plan SET task_id=?,version=version+1 WHERE id=?", Long.valueOf(task.id()), id);
    }
    return plan(id, false, false);
  }

  @Transactional
  public Map<String, Object> execute(long id, ExecutionRequest request) {
    var current = plan(id, false, true);
    var cycle = cycle(number(current, "cycle_id"), false, true);
    if (!"APPROVED".equals(current.get("status")) || current.get("task_id") == null) throw bad("Se requiere un plan aprobado con tarea");
    var task = jdbc.queryForMap("SELECT assignee_id,status FROM farm_task WHERE id=? FOR UPDATE", current.get("task_id"));
    if (number(task, "assignee_id") != access.userId()) access.requireAgronomic(access.blockFarm(number(cycle, "block_id")));
    if (!Set.of("pending", "progress").contains(task.get("status"))) throw bad("La tarea debe estar pendiente o en progreso");
    if (request.executedOn().isBefore(((java.sql.Date) current.get("window_from")).toLocalDate()) || request.executedOn().isAfter(((java.sql.Date) current.get("window_to")).toLocalDate())) throw bad("La ejecución está fuera de la ventana del plan");
    BigDecimal areaUsed = jdbc.queryForObject("SELECT COALESCE(SUM(area_ha),0) FROM planting_execution WHERE plan_id=?", BigDecimal.class, id);
    int plantsUsed = Optional.ofNullable(jdbc.queryForObject("SELECT COALESCE(SUM(plants_planted),0) FROM planting_execution WHERE plan_id=?", Integer.class, id)).orElse(0);
    if (areaUsed.add(request.areaHa()).compareTo((BigDecimal) current.get("planned_area_ha")) > 0 || plantsUsed + request.plantsPlanted() > number(current, "target_plants")) throw bad("La ejecución acumulada supera el plan");
    long eventId = insert("INSERT INTO field_event(event_type,occurred_at,created_by_user_id,block_id,row_id,notes) VALUES ('HANDLING_EVENT',?,?,?,?,?)", Timestamp.valueOf(request.executedOn().atStartOfDay()), access.userId(), number(cycle, "block_id"), cycle.get("row_id"), "Siembra · plan #" + id + " · " + request.plantsPlanted() + " plantas");
    long executionId = insert("INSERT INTO planting_execution(plan_id,event_id,executed_on,area_ha,material_lot_id,plants_planted,plants_rejected,location_details,operator_notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)", id, eventId, request.executedOn(), request.areaHa(), current.get("material_lot_id"), request.plantsPlanted(), request.plantsRejected(), request.locationDetails(), request.operatorNotes(), access.userId());
    jdbc.update("UPDATE crop_cycle SET status='ESTABLISHING',current_stage='ESTABLISHMENT',planted_on=COALESCE(planted_on,?),version=version+1 WHERE id=?", request.executedOn(), cycle.get("id"));
    jdbc.update("UPDATE farm_task SET status='progress',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'", current.get("task_id"));
    var result = new LinkedHashMap<String, Object>(); result.put("id", executionId); result.put("planId", id); result.put("eventId", eventId); result.put("executedOn", request.executedOn()); result.put("areaHa", request.areaHa()); result.put("plantsPlanted", request.plantsPlanted()); return result;
  }

  @Transactional
  public Map<String, Object> establishmentCheck(long cycleId, EstablishmentCheckRequest request) {
    cycle(cycleId, false, true);
    if (request.survivingPlants() + request.deadPlants() > request.plantsChecked()) throw bad("Supervivientes y muertas no pueden superar el conteo");
    long id = insert("INSERT INTO planting_establishment_check(cycle_id,checked_on,plants_checked,surviving_plants,dead_plants,replaced_plants,uniformity,causes,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)", cycleId, request.checkedOn(), request.plantsChecked(), request.survivingPlants(), request.deadPlants(), request.replacedPlants(), request.uniformity(), request.causes(), request.notes(), access.userId());
    return row("planting_establishment_check", id);
  }

  @Transactional
  public Map<String, Object> observeStage(long cycleId, StageRequest request) {
    var cycle = cycle(cycleId, false, true);
    long id = insert("INSERT INTO crop_cycle_stage_history(cycle_id,stage,observed_on,notes,created_by) VALUES (?,?,?,?,?)", cycleId, request.stage().name(), request.observedOn(), request.notes(), access.userId());
    String status = request.stage() == Stage.CLOSED ? "CLOSED" : request.stage() == Stage.PLANNED ? "PLANNED" : "ACTIVE";
    jdbc.update("UPDATE crop_cycle SET current_stage=?,status=?,closed_on=CASE WHEN ?='CLOSED' THEN ? ELSE closed_on END,version=version+1 WHERE id=?", request.stage().name(), status, request.stage().name(), request.observedOn(), cycleId);
    return presentCycle(cycle(cycleId, false, false));
  }
}
