package com.yourco.agro.fertilization;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.finances.FinanceDtos;
import com.yourco.agro.finances.FinanceService;
import com.yourco.agro.inventory.InventoryService;
import com.yourco.agro.persistence.JpaSql;
import com.yourco.agro.tasks.TaskDtos;
import com.yourco.agro.tasks.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import static com.yourco.agro.fertilization.FertilizationDtos.*;

@Service
public class FertilizationService {
  private static final String APPLICATION_SELECT = """
    SELECT a.*, expense.amount AS cost_cop FROM fertilization_application a
    LEFT JOIN farm_financial_entry expense ON expense.id=a.financial_entry_id
    """;
  private record ApplicationDetails(Instant occurredAt, BigDecimal quantity, BigDecimal coverage,
                                    String method, String lot, String notes) {}

  private final JpaSql queries;
  private final FarmAccess access;
  private final TaskService tasks;
  private final InventoryService inventory;
  private final FinanceService finance;
  private final ObjectMapper json;
  public FertilizationService(JpaSql queries, FarmAccess access, TaskService tasks,
                             InventoryService inventory, FinanceService finance, ObjectMapper json) {
    this.queries = queries; this.access = access; this.tasks = tasks;
    this.inventory = inventory; this.finance = finance; this.json = json;
  }
  private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
  private String encode(Object value) {
    try { return json.writeValueAsString(value); } catch (Exception exception) { throw new IllegalStateException(exception); }
  }
  private Map<String,Object> decode(String value) {
    try { return json.readValue(value, new TypeReference<LinkedHashMap<String,Object>>() {}); }
    catch (Exception exception) { throw new IllegalStateException(exception); }
  }
  private Map<String,Object> row(String table, long id) {
    var rows = queries.rows("SELECT * FROM " + table + " WHERE id=?", id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Registro no encontrado");
    return rows.get(0);
  }
  private long number(Map<String,Object> row, String key) { return ((Number) row.get(key)).longValue(); }
  private Map<String,Object> analysisRow(long id) {
    var rows = queries.rows("SELECT id,block_id,sampled_on,details,created_by,report_type FROM soil_analysis WHERE id=?",id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Análisis no encontrado");
    var row = rows.get(0); access.require(access.blockFarm(number(row,"block_id")),false); return row;
  }
  private Map<String,Object> planRow(long id, boolean manage, boolean lock) {
    var row = row("fertilization_plan",id); access.require(access.blockFarm(number(row,"block_id")),manage);
    if (lock) return queries.row("SELECT * FROM fertilization_plan WHERE id=? FOR UPDATE",id);
    return row;
  }
  private Map<String,Object> presentAnalysis(Map<String,Object> row) {
    var result = decode((String) row.get("details")); result.put("id",row.get("id")); result.put("createdBy",row.get("created_by"));
    result.put("hasReport",row.get("report_type") != null);
    result.put("interpretations", interpretations(row));
    result.put("review", reviewRow(number(row,"id")));
    return result;
  }
  private record PlanTask(long taskId, LocalDate occurrenceOn) {}
  private record PlanFollowup(long id, Long analysisId, String observations, long reviewedBy, Instant reviewedAt) {}

  private Map<String,Object> presentPlan(Map<String,Object> row) {
    var result = decode((String) row.get("details"));
    for (var entry : Map.ofEntries(Map.entry("id","id"),Map.entry("status","status"),Map.entry("version","version"),Map.entry("taskId","task_id"),Map.entry("totalQuantity","total_quantity"),Map.entry("createdBy","created_by"),Map.entry("approvedBy","approved_by"),Map.entry("approvedAt","approved_at"),Map.entry("decisionReason","decision_reason"),Map.entry("productId","product_id"),Map.entry("recurrence","recurrence"),Map.entry("recurrenceUntil","recurrence_until")).entrySet()) {
      Object value = row.get(entry.getValue()); result.put(entry.getKey(),value == null ? null : value instanceof java.time.temporal.TemporalAccessor ? value.toString() : value);
    }
    result.put("appliedQuantity",queries.value("SELECT COALESCE(SUM(quantity),0) FROM fertilization_application WHERE plan_id=?",BigDecimal.class,row.get("id")));
    var tasks = queries.select("""
      SELECT task_id, occurrence_on FROM fertilization_plan_task WHERE plan_id = ? ORDER BY occurrence_on
      """, task -> new PlanTask(task.longValue("task_id"), task.date("occurrence_on")), row.get("id"));
    result.put("tasks", tasks);
    if (!"NONE".equals(row.get("recurrence")) && !tasks.isEmpty()) {
      result.put("totalQuantity",((BigDecimal) row.get("total_quantity")).multiply(BigDecimal.valueOf(tasks.size())));
    }
    result.put("canceledBy",row.get("canceled_by")); result.put("canceledAt",row.get("canceled_at"));
    result.put("followups", queries.select("""
      SELECT id, analysis_id, observations, reviewed_by, reviewed_at
      FROM fertilization_followup WHERE plan_id = ? ORDER BY id DESC
      """, followup -> new PlanFollowup(followup.longValue("id"), followup.value("analysis_id", Long.class),
      followup.text("observations"), followup.longValue("reviewed_by"), followup.instant("reviewed_at")), row.get("id")));
    return result;
  }
  public Map<String,Object> list(long farmId) {
    access.require(farmId,false);
    var analyses = queries.rows("SELECT a.id,a.block_id,a.details,a.created_by,a.report_type FROM soil_analysis a JOIN block b ON b.id=a.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY sampled_on DESC,a.id DESC",farmId).stream().map(this::presentAnalysis).toList();
    var plans = queries.rows("SELECT p.* FROM fertilization_plan p JOIN block b ON b.id=p.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY p.id DESC",farmId).stream().map(this::presentPlan).toList();
    boolean includeFinance = canReadFinance(farmId);
    var applications = queries.rows(APPLICATION_SELECT + """
      JOIN fertilization_plan p ON p.id=a.plan_id JOIN block b ON b.id=p.block_id
      JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY a.id DESC
      """, farmId).stream().map(row -> presentApplication(row, includeFinance)).toList();
    return Map.of("analyses",analyses,"plans",plans,"applications",applications);
  }
  private boolean canReadFinance(long farmId) {
    return "ADMIN".equals(queries.value("SELECT role FROM farm_membership WHERE farm_id=? AND user_id=?",
      String.class, farmId, access.userId()));
  }
  private Map<String,Object> presentApplication(Map<String,Object> row, boolean includeFinance) {
    var result = decode((String) row.get("details"));
    result.put("id", row.get("id"));
    result.put("planId", row.get("plan_id"));
    result.put("taskId", row.get("task_id"));
    result.put("eventId", row.get("event_id"));
    result.put("createdBy", row.get("created_by"));
    if (row.get("operation_id") != null) {
      result.put("operationId", row.get("operation_id"));
      result.put("inventoryLotId", row.get("inventory_lot_id"));
      result.put("inventoryMovementId", row.get("inventory_movement_id"));
      if (includeFinance) {
        result.put("financialEntryId", row.get("financial_entry_id"));
        result.put("costCop", row.get("cost_cop"));
      }
    }
    return result;
  }
  public List<Map<String,Object>> profiles(long farmId) {
    access.require(farmId,false);
    return queries.rows("SELECT id FROM nutrient_reference_profile WHERE farm_id=? AND active=TRUE ORDER BY id DESC",farmId)
      .stream().map(row -> profile(number(row,"id"))).toList();
  }
  public List<Map<String,Object>> products(long farmId) {
    access.require(farmId,false);
    return queries.rows("SELECT id FROM fertilizer_product WHERE farm_id=? AND active=TRUE ORDER BY name,id",farmId)
      .stream().map(row -> product(number(row,"id"))).toList();
  }
  @Transactional
  public Map<String,Object> createProduct(Product request) {
    access.requireAgronomic(request.farmId());
    try {
      long id = queries.insert("INSERT INTO fertilizer_product(farm_id,code,name,composition,default_dose_unit,notes,created_by) VALUES (?,?,?,?,?,?,?)",
        request.farmId(),request.code().trim(),request.name().trim(),request.composition().trim(),request.defaultDoseUnit().name(),request.notes(),access.userId());
      return product(id);
    } catch (org.springframework.dao.DuplicateKeyException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,"El código del producto ya existe en la finca");
    }
  }
  private Map<String,Object> product(long id) {
    var rows = queries.rows("SELECT id,farm_id,code,name,composition,default_dose_unit,notes,active,created_by,created_at FROM fertilizer_product WHERE id=?",id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Producto fertilizante no encontrado");
    var row = rows.get(0); var result = new LinkedHashMap<String,Object>();
    result.put("id",row.get("id")); result.put("farmId",row.get("farm_id")); result.put("code",row.get("code")); result.put("name",row.get("name"));
    result.put("composition",row.get("composition")); result.put("defaultDoseUnit",row.get("default_dose_unit")); result.put("notes",row.get("notes"));
    result.put("active",row.get("active")); result.put("createdBy",row.get("created_by")); result.put("createdAt",row.get("created_at")); return result;
  }
  private Map<String,Object> productForPlan(Long productId, long farmId) {
    if (productId == null) return null;
    var rows = queries.rows("SELECT * FROM fertilizer_product WHERE id=? AND farm_id=? AND active=TRUE",productId,farmId);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Producto fertilizante no encontrado en la finca");
    return rows.get(0);
  }
  private Recurrence recurrence(Plan plan) { return plan.recurrence()==null ? Recurrence.NONE : plan.recurrence(); }
  @Transactional
  public Map<String,Object> createProfile(Profile request) {
    access.requireAgronomic(request.farmId());
    var nutrients = new HashSet<Nutrient>();
    for (var range : request.ranges()) {
      if (!nutrients.add(range.nutrient())) throw bad("No repitas un nutriente en el perfil");
      validateRange(range);
    }
    long id = queries.insert("INSERT INTO nutrient_reference_profile(farm_id,name,crop,variety,sample_type,version,source,created_by) VALUES (?,?,?,?,?,?,?,?)",
      request.farmId(),request.name(),request.crop(),request.variety(),request.sampleType().name(),request.version(),request.source(),access.userId());
    for (var range : request.ranges()) {
      queries.execute("INSERT INTO nutrient_reference_range(profile_id,nutrient,unit,lower_bound,upper_bound) VALUES (?,?,?,?,?)",
        id,range.nutrient().name(),range.unit().name(),range.lowerBound(),range.upperBound());
    }
    return profile(id);
  }
  private void validateRange(Range range) {
    if (range.lowerBound().compareTo(range.upperBound()) >= 0) throw bad("El límite inferior debe ser menor que el superior");
    if ((range.nutrient()==Nutrient.PH)!=(range.unit()==Unit.PH)) throw bad("Unidad de pH incorrecta en el perfil");
    if (range.nutrient()==Nutrient.PH && range.upperBound().compareTo(BigDecimal.valueOf(14))>0) throw bad("pH debe estar entre 0 y 14");
    if (range.unit()==Unit.PERCENT && range.upperBound().compareTo(BigDecimal.valueOf(100))>0) throw bad("Porcentaje fuera de rango");
  }
  private Map<String,Object> profile(long id) {
    var rows = queries.rows("SELECT p.id,p.farm_id,p.name,p.crop,p.variety,p.sample_type,p.version,p.source,p.active,r.nutrient,r.unit,r.lower_bound,r.upper_bound FROM nutrient_reference_profile p JOIN nutrient_reference_range r ON r.profile_id=p.id WHERE p.id=? ORDER BY r.id",id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Perfil nutricional no encontrado");
    var first = rows.get(0); var result = new LinkedHashMap<String,Object>();
    result.put("id",first.get("id")); result.put("farmId",first.get("farm_id")); result.put("name",first.get("name"));
    result.put("crop",first.get("crop")); result.put("variety",first.get("variety")); result.put("sampleType",first.get("sample_type"));
    result.put("version",first.get("version")); result.put("source",first.get("source")); result.put("active",first.get("active"));
    result.put("ranges",rows.stream().map(row -> {
      var range = new LinkedHashMap<String,Object>(); range.put("nutrient",row.get("nutrient")); range.put("unit",row.get("unit"));
      range.put("lowerBound",row.get("lower_bound")); range.put("upperBound",row.get("upper_bound")); return range;
    }).toList());
    return result;
  }
  @Transactional
  public Map<String,Object> review(long id, Review request) {
    var sample = analysisRow(id); access.requireAgronomic(access.blockFarm(number(sample,"block_id")));
    if (queries.execute("UPDATE nutrient_analysis_review SET decision=?,notes=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE analysis_id=?",
      request.decision().name(),request.notes(),access.userId(),id)==0) {
      queries.execute("INSERT INTO nutrient_analysis_review(analysis_id,decision,notes,reviewed_by) VALUES (?,?,?,?)",
        id,request.decision().name(),request.notes(),access.userId());
    }
    return Objects.requireNonNull(reviewRow(id));
  }
  private Map<String,Object> reviewRow(long analysisId) {
    var rows = queries.rows("SELECT decision,notes,reviewed_by,reviewed_at FROM nutrient_analysis_review WHERE analysis_id=?",analysisId);
    if (rows.isEmpty()) return null;
    var row = rows.get(0); var result = new LinkedHashMap<String,Object>();
    result.put("decision",row.get("decision")); result.put("notes",row.get("notes")); result.put("reviewedBy",row.get("reviewed_by"));
    result.put("reviewedAt",row.get("reviewed_at")); return result;
  }
  @SuppressWarnings("unchecked")
  private List<Map<String,Object>> interpretations(Map<String,Object> row) {
    var analysis = decode((String) row.get("details"));
    var context = queries.row("SELECT b.crop,b.variety,f.farm_id FROM block b JOIN field f ON f.id=b.field_id WHERE b.id=?",row.get("block_id"));
    var profileRows = queries.rows("""
      SELECT p.id,p.name,p.version,p.source,r.nutrient,r.unit,r.lower_bound,r.upper_bound
      FROM nutrient_reference_profile p JOIN nutrient_reference_range r ON r.profile_id=p.id
      WHERE p.farm_id=? AND LOWER(p.crop)=LOWER(?) AND p.sample_type=? AND p.active=TRUE
        AND (p.variety IS NULL OR LOWER(p.variety)=LOWER(?))
      ORDER BY CASE WHEN p.variety IS NULL THEN 1 ELSE 0 END,p.id DESC
      """,context.get("farm_id"),context.get("crop"),analysis.get("sampleType"),context.get("variety"));
    Long selectedProfile = profileRows.isEmpty() ? null : number(profileRows.get(0),"id");
    var selected = selectedProfile == null ? List.<Map<String,Object>>of() : profileRows.stream().filter(item -> number(item,"id")==selectedProfile).toList();
    var results = (List<Map<String,Object>>) analysis.get("results");
    return results.stream().<Map<String,Object>>map(item -> {
      var interpretation = new LinkedHashMap<String,Object>(); interpretation.put("nutrient",item.get("nutrient"));
      interpretation.put("value",item.get("value")); interpretation.put("unit",item.get("unit"));
      var range = selected.stream().filter(candidate -> candidate.get("nutrient").equals(item.get("nutrient")) && candidate.get("unit").equals(item.get("unit"))).findFirst().orElse(null);
      String status = "UNKNOWN"; String reason;
      if (range == null) reason = selected.isEmpty() ? "No hay un perfil activo compatible con este cultivo y tipo de muestra." : "No hay un rango compatible para este nutriente y unidad.";
      else {
        var value = new BigDecimal(item.get("value").toString()); var lower = new BigDecimal(range.get("lower_bound").toString()); var upper = new BigDecimal(range.get("upper_bound").toString());
        status = value.compareTo(lower)<0 ? "LOW" : value.compareTo(upper)>0 ? "HIGH" : "ADEQUATE";
        reason = "Rango de referencia: "+lower+"–"+upper+" "+range.get("unit")+". Requiere revisión técnica.";
        interpretation.put("profileId",range.get("id")); interpretation.put("profileName",range.get("name")); interpretation.put("profileVersion",range.get("version")); interpretation.put("source",range.get("source"));
      }
      String label = "UNKNOWN".equals(status) ? "Sin interpretar" : "PH".equals(item.get("nutrient")) ? "LOW".equals(status) ? "pH ácido" : "HIGH".equals(status) ? "pH alcalino" : "pH en rango" : "LOW".equals(status) ? "Bajo" : "HIGH".equals(status) ? "Alto" : "En rango";
      interpretation.put("status",status); interpretation.put("label",label); interpretation.put("requiresTechnicalReview",true); interpretation.put("reason",reason); return interpretation;
    }).toList();
  }
  @Transactional
  public Map<String,Object> createAnalysis(Analysis request) {
    access.require(access.blockFarm(request.blockId()),false);
    if ((request.latitude()==null)!=(request.longitude()==null)) throw bad("Indica ambas coordenadas o ninguna");
    var nutrients = new HashSet<Nutrient>();
    for (var result : request.results()) {
      if (!nutrients.add(result.nutrient())) throw bad("No repitas un nutriente en la muestra");
      if ((result.nutrient()==Nutrient.PH)!=(result.unit()==Unit.PH)) throw bad("Unidad de pH incorrecta");
      if (result.nutrient()==Nutrient.PH && result.value().compareTo(BigDecimal.valueOf(14))>0) throw bad("pH debe estar entre 0 y 14");
      if (result.unit()==Unit.PERCENT && result.value().compareTo(BigDecimal.valueOf(100))>0) throw bad("Porcentaje fuera de rango");
    }
    long id = queries.insert("INSERT INTO soil_analysis(block_id,sampled_on,details,created_by) VALUES (?,?,?,?)",request.blockId(),request.sampledOn(),encode(request),access.userId());
    return presentAnalysis(analysisRow(id));
  }
  public static BigDecimal total(Plan request) {
    return request.dose().multiply(request.coverage()).divide(request.doseUnit()==DoseUnit.G_PLANT || request.doseUnit()==DoseUnit.ML_PLANT ? BigDecimal.valueOf(1000) : BigDecimal.ONE,6,RoundingMode.HALF_UP);
  }
  @Transactional
  public Map<String,Object> createPlan(Plan request) {
    long farmId = access.blockFarm(request.blockId()); access.require(farmId,true);
    var sample = analysisRow(request.analysisId());
    if (number(sample,"block_id")!=request.blockId()) throw bad("El análisis debe pertenecer al bloque del plan");
    Analysis analysis = json.convertValue(decode((String) sample.get("details")),Analysis.class);
    if (request.scheduledOn().isBefore(analysis.sampledOn()) || request.followUpOn().isBefore(request.scheduledOn())) throw bad("Revisa las fechas de muestra, aplicación y seguimiento");
    if (request.doseUnit()==DoseUnit.G_PLANT || request.doseUnit()==DoseUnit.ML_PLANT) {
      if (request.coverage().stripTrailingZeros().scale()>0) throw bad("El número de plantas debe ser entero");
    } else {
      var areas = queries.values("SELECT area_ha FROM block WHERE id=?",BigDecimal.class,request.blockId());
      if (areas.get(0)!=null && request.coverage().compareTo(areas.get(0))>0) throw bad("El área supera el bloque");
    }
    if (request.inspectionId()!=null) {
      var inspection = row("phytosanitary_inspection",request.inspectionId());
      if (number(inspection,"block_id")!=request.blockId() || inspection.get("canceled_at")!=null) throw bad("La inspección debe estar vigente y pertenecer al bloque");
    }
    if (queries.value("SELECT COUNT(*) FROM farm_membership WHERE farm_id=? AND user_id=?",Integer.class,farmId,request.assigneeId())!=1) throw bad("El responsable debe pertenecer a la finca");
    Recurrence recurrence = recurrence(request);
    if (recurrence==Recurrence.NONE && request.recurrenceUntil()!=null) throw bad("Una aplicación única no puede tener fecha de recurrencia");
    if (recurrence!=Recurrence.NONE && (request.recurrenceUntil()==null || request.recurrenceUntil().isBefore(request.scheduledOn()) || request.recurrenceUntil().isAfter(request.scheduledOn().plusYears(2)))) throw bad("La recurrencia debe terminar entre la fecha programada y dos años después");
    var catalogProduct = productForPlan(request.productId(),farmId);
    if (catalogProduct!=null && !request.doseUnit().name().equals(catalogProduct.get("default_dose_unit"))) throw bad("La unidad de dosis no coincide con la unidad estándar del producto");
    BigDecimal total = total(request); if (total.signum()<=0 || total.precision()-total.scale()>10) throw bad("Cantidad total fuera de rango");
    var details = new LinkedHashMap<String,Object>(json.convertValue(request,new TypeReference<Map<String,Object>>() {}));
    if (catalogProduct!=null) { details.put("product",catalogProduct.get("name")); details.put("composition",catalogProduct.get("composition")); }
    details.put("recurrence",recurrence.name());
    long id = queries.insert("INSERT INTO fertilization_plan(block_id,analysis_id,inspection_id,details,total_quantity,product_id,recurrence,recurrence_until,created_by) VALUES (?,?,?,?,?,?,?,?,?)",
      request.blockId(),request.analysisId(),request.inspectionId(),encode(details),total,request.productId(),recurrence.name(),request.recurrenceUntil(),access.userId());
    return presentPlan(planRow(id,true,false));
  }
  @Transactional
  public Map<String,Object> decision(long id, Decision request, boolean approve) {
    var row = planRow(id,true,true);
    if (number(row,"version")!=request.version() || (approve && !"DRAFT".equals(row.get("status"))) || "CANCELED".equals(row.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"El plan cambió o ya fue decidido");
    if (!approve && row.get("task_id")!=null) throw bad("Un plan con tarea no puede anularse; bloquea la tarea y conserva la trazabilidad");
    if (approve) queries.execute("UPDATE fertilization_plan SET status='APPROVED',version=version+1,decision_reason=?,approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=?",request.reason(),access.userId(),id);
    else queries.execute("UPDATE fertilization_plan SET status='CANCELED',version=version+1,decision_reason=?,canceled_by=?,canceled_at=CURRENT_TIMESTAMP WHERE id=?",request.reason(),access.userId(),id);
    if (approve && !"NONE".equals(row.get("recurrence"))) task(id);
    return presentPlan(planRow(id,true,false));
  }
  @Transactional
  public Map<String,Object> task(long id) {
    var row = planRow(id,true,true);
    if (!"APPROVED".equals(row.get("status"))) throw bad("Aprueba el plan antes de generar tareas");
    Plan plan = json.convertValue(decode((String) row.get("details")),Plan.class);
    Recurrence recurrence = recurrence(plan);
    var occurrence = plan.scheduledOn(); var last = recurrence==Recurrence.NONE ? occurrence : plan.recurrenceUntil();
    Long firstTask = row.get("task_id") == null ? null : number(row,"task_id");
    while (!occurrence.isAfter(last)) {
      var existing = queries.rows("SELECT task_id FROM fertilization_plan_task WHERE plan_id=? AND occurrence_on=?",id,occurrence);
      if (existing.isEmpty()) {
        var task = tasks.create(new TaskDtos.CreateRequest(access.blockFarm(plan.blockId()),null,plan.blockId(),plan.assigneeId(),"Fertilización #"+id+" · "+plan.product().substring(0,Math.min(100,plan.product().length())),TaskDtos.Activity.fertilization,occurrence,plan.scheduledTime(),TaskDtos.Priority.Media,
          "Plan aprobado #"+id+". Producto: "+plan.product()+". Composición: "+plan.composition()+". Dosis: "+plan.dose()+" "+plan.doseUnit()+". Cobertura: "+plan.coverage()+". Total: "+row.get("total_quantity")+" "+quantityUnit(plan.doseUnit())+". Método: "+plan.method()+". Seguimiento: "+plan.followUpOn()+"."));
        queries.execute("INSERT INTO fertilization_plan_task(plan_id,task_id,occurrence_on) VALUES (?,?,?)",id,Long.valueOf(task.id()),occurrence);
        if (firstTask==null) firstTask=Long.valueOf(task.id());
      } else if (firstTask==null) firstTask=number(existing.get(0),"task_id");
      occurrence = nextOccurrence(occurrence,recurrence);
    }
    if (row.get("task_id")==null && firstTask!=null) queries.execute("UPDATE fertilization_plan SET task_id=?,version=version+1 WHERE id=?",firstTask,id);
    return presentPlan(planRow(id,true,false));
  }
  private LocalDate nextOccurrence(LocalDate date, Recurrence recurrence) {
    return switch (recurrence) { case WEEKLY -> date.plusWeeks(1); case BIWEEKLY -> date.plusWeeks(2); case MONTHLY -> date.plusMonths(1); case NONE -> date.plusYears(10); };
  }
  @Transactional
  public void assignTask(long id, long taskId, TaskAssignment request) {
    var plan = planRow(id, true, true);
    if (!"APPROVED".equals(plan.get("status"))) throw bad("Aprueba el plan antes de asignar sus tareas");
    long farmId = access.blockFarm(number(plan, "block_id"));
    if (!Objects.equals(taskId, JpaSql.convert(plan.get("task_id"), Long.class))
        && queries.value("SELECT COUNT(*) FROM fertilization_plan_task WHERE plan_id=? AND task_id=?", Long.class, id, taskId) == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La tarea no pertenece al plan");
    }
    if (queries.values("SELECT user_id FROM farm_membership WHERE farm_id=? AND user_id=? FOR UPDATE",
        Long.class, farmId, request.assigneeId()).isEmpty()) {
      throw bad("El responsable debe pertenecer a la finca");
    }
    int changed = queries.execute("""
      UPDATE farm_task SET assignee_id=?, version=version+1, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND farm_id=? AND status='pending' AND version=?
      """, request.assigneeId(), taskId, farmId, request.version());
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT,
      "Solo puedes reasignar una tarea pendiente con su versión actual");
  }
  public static String quantityUnit(DoseUnit unit) { return unit==DoseUnit.L_HA || unit==DoseUnit.ML_PLANT ? "L":"kg"; }
  @Transactional
  public Map<String,Object> apply(long id, Application request) {
    var row = planRow(id,false,true);
    Plan plan = json.convertValue(decode((String) row.get("details")),Plan.class);
    long farmId = access.blockFarm(plan.blockId());
    long userId = access.userId();
    Recurrence recurrence = recurrence(plan);
    Long taskId = request.taskId();
    if (taskId == null && recurrence == Recurrence.NONE && row.get("task_id") != null) taskId = number(row, "task_id");
    var previous = queries.rows(APPLICATION_SELECT + " WHERE a.plan_id=? AND a.operation_id=?", id, request.operationId())
      .stream().findFirst();
    if (previous.isPresent()) {
      var saved = previous.get();
      if (number(saved, "created_by") != userId || !sameApplication(saved, taskId, request)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Este identificador ya corresponde a otra aplicación. Consulta los registros de fertilización.");
      }
      return presentApplication(saved, canReadFinance(farmId));
    }

    if (!"APPROVED".equals(row.get("status")) || row.get("task_id")==null) throw bad("Se requiere un plan aprobado con tarea");
    if (recurrence!=Recurrence.NONE && request.taskId()==null) throw bad("Selecciona la ocurrencia de la tarea recurrente");
    if (request.taskId()!=null && queries.value("SELECT COUNT(*) FROM fertilization_plan_task WHERE plan_id=? AND task_id=?",Integer.class,id,request.taskId())!=1) throw bad("La tarea no pertenece a la ocurrencia del plan");
    var task = queries.row("SELECT assignee_id,status FROM farm_task WHERE id=? FOR UPDATE",taskId);
    if (number(task,"assignee_id")!=userId) access.require(farmId,true);
    if (!Set.of("pending","progress").contains(task.get("status"))) throw bad("La tarea debe estar pendiente o en progreso");
    LocalDate appliedOn = request.occurredAt().atOffset(ZoneOffset.UTC).toLocalDate();
    if (request.occurredAt().isAfter(Instant.now()) || appliedOn.isBefore(json.convertValue(decode((String) analysisRow(plan.analysisId()).get("details")),Analysis.class).sampledOn())) throw bad("Fecha de aplicación inválida");
    if (request.coverage().compareTo(plan.coverage())>0 || ((plan.doseUnit()==DoseUnit.G_PLANT || plan.doseUnit()==DoseUnit.ML_PLANT) && request.coverage().stripTrailingZeros().scale()>0)) throw bad("Cobertura inválida");
    BigDecimal applied = recurrence==Recurrence.NONE
      ? queries.value("SELECT COALESCE(SUM(quantity),0) FROM fertilization_application WHERE plan_id=?",BigDecimal.class,id)
      : queries.value("SELECT COALESCE(SUM(quantity),0) FROM fertilization_application WHERE plan_id=? AND task_id=?",BigDecimal.class,id,taskId);
    if (applied.add(request.quantity()).compareTo((BigDecimal) row.get("total_quantity"))>0) throw bad("La cantidad acumulada supera el plan aprobado; requiere un nuevo plan");
    String unit = quantityUnit(plan.doseUnit());
    var consumption = inventory.consumeForApplication(farmId, request.inventoryLotId(), request.operationId(),
      request.quantity(), plan.product(), unit, appliedOn, "Fertilización · plan #" + id);
    var details = new ApplicationDetails(request.occurredAt(), request.quantity(), request.coverage(),
      request.method(), consumption.lotCode(), request.notes());
    String eventNotes = String.join(" · ", "Plan #" + id, plan.product(), request.quantity() + " " + unit,
      "Lote " + consumption.lotCode(), Objects.toString(request.notes(), ""));
    long eventId = queries.insert("INSERT INTO field_event(event_type,occurred_at,created_by_user_id,block_id,notes) VALUES ('FERTILIZER_APPLICATION',?,?,?,?)",
      request.occurredAt(), userId, plan.blockId(), eventNotes);
    long applicationId = queries.insert("""
      INSERT INTO fertilization_application(plan_id,event_id,task_id,quantity,details,created_by,operation_id,inventory_lot_id,inventory_movement_id)
      VALUES (?,?,?,?,?,?,?,?,?)
      """, id, eventId, taskId, request.quantity(), encode(details), userId, request.operationId(), request.inventoryLotId(), consumption.movementId());
    long entryId = finance.recordApplicationExpense(farmId, plan.blockId(), request.operationId(), appliedOn,
      FinanceDtos.Category.FERTILIZERS, consumption.costCop(),
      "Fertilización · " + consumption.productName() + " · lote " + consumption.lotCode(), "FERTILIZATION_APPLICATION", applicationId);
    queries.execute("UPDATE fertilization_application SET financial_entry_id=? WHERE id=?", entryId, applicationId);
    queries.execute("UPDATE farm_task SET status='progress',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",taskId);
    return presentApplication(queries.row(APPLICATION_SELECT + " WHERE a.id=?", applicationId), canReadFinance(farmId));
  }
  private boolean sameApplication(Map<String,Object> row, Long taskId, Application request) {
    if (!Objects.equals(taskId, JpaSql.convert(row.get("task_id"), Long.class))
      || !Objects.equals(request.inventoryLotId(), JpaSql.convert(row.get("inventory_lot_id"), Long.class))) return false;
    ApplicationDetails saved;
    try { saved = json.readValue((String) row.get("details"), ApplicationDetails.class); }
    catch (Exception exception) { throw new IllegalStateException(exception); }
    return saved.occurredAt().equals(request.occurredAt())
      && saved.quantity().compareTo(request.quantity()) == 0
      && saved.coverage().compareTo(request.coverage()) == 0
      && saved.method().equals(request.method()) && Objects.equals(saved.notes(), request.notes());
  }
  @Transactional
  public void followup(long id, Followup request) {
    var row = planRow(id,true,true);
    if (!"APPROVED".equals(row.get("status"))) throw bad("Solo se revisan planes aprobados");
    if (request.analysisId()!=null) {
      var sample = analysisRow(request.analysisId());
      if (number(sample,"block_id")!=number(row,"block_id")) throw bad("El análisis de seguimiento debe pertenecer al mismo bloque");
      Plan plan = json.convertValue(decode((String) row.get("details")),Plan.class);
      Analysis analysis = json.convertValue(decode((String) sample.get("details")),Analysis.class);
      if (analysis.sampledOn().isBefore(plan.scheduledOn())) throw bad("La muestra de seguimiento debe ser posterior a la fecha programada");
    }
    queries.execute("INSERT INTO fertilization_followup(plan_id,analysis_id,observations,reviewed_by) VALUES (?,?,?,?)",id,request.analysisId(),request.observations(),access.userId());
  }
  @Transactional
  public void report(long id, byte[] data, String type) {
    analysisRow(id);
    if (data.length==0 || data.length>10*1024*1024 || !"application/pdf".equals(type) || data.length<5 || !new String(data,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) throw bad("Adjunta un PDF de laboratorio de hasta 10 MB");
    var sample = analysisRow(id);
    if (number(sample,"created_by")!=access.userId()) access.require(access.blockFarm(number(sample,"block_id")),true);
    if (sample.get("report_type")!=null) throw new ResponseStatusException(HttpStatus.CONFLICT,"El informe ya está adjunto; registra una nueva muestra para corregirlo");
    if (queries.execute("UPDATE soil_analysis SET report=?,report_type=? WHERE id=? AND report_type IS NULL",data,type,id)!=1) throw new ResponseStatusException(HttpStatus.CONFLICT,"El informe ya fue adjuntado");
  }
  public byte[] report(long id) {
    var row = analysisRow(id); if (row.get("report_type")==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Sin informe adjunto"); return queries.value("SELECT report FROM soil_analysis WHERE id=?",byte[].class,id);
  }
  public Map<String,Object> latestSoil(long blockId) {
    var rows = queries.rows("SELECT id,block_id,details,created_by,report_type FROM soil_analysis WHERE block_id=? ORDER BY sampled_on DESC,id DESC",blockId);
    for (var row : rows) {
      var sample = decode((String) row.get("details"));
      if ("SOIL".equals(sample.get("sampleType"))) return presentAnalysis(row);
    }
    return null;
  }
}
