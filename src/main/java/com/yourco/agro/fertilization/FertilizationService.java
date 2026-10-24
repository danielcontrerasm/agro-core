package com.yourco.agro.fertilization;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.tasks.TaskDtos;
import com.yourco.agro.tasks.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import static com.yourco.agro.fertilization.FertilizationDtos.*;

@Service
public class FertilizationService {
  private final JdbcTemplate jdbc;
  private final FarmAccess access;
  private final TaskService tasks;
  private final ObjectMapper json;
  public FertilizationService(JdbcTemplate jdbc, FarmAccess access, TaskService tasks, ObjectMapper json) {
    this.jdbc = jdbc; this.access = access; this.tasks = tasks; this.json = json;
  }
  private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
  private String encode(Object value) {
    try { return json.writeValueAsString(value); } catch (Exception exception) { throw new IllegalStateException(exception); }
  }
  private Map<String,Object> decode(String value) {
    try { return json.readValue(value, new TypeReference<LinkedHashMap<String,Object>>() {}); }
    catch (Exception exception) { throw new IllegalStateException(exception); }
  }
  private long insert(String sql, Object... values) {
    var key = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      var statement = connection.prepareStatement(sql, new String[]{"id"});
      for (int index = 0; index < values.length; index++) statement.setObject(index + 1, values[index]);
      return statement;
    }, key);
    return Objects.requireNonNull(key.getKey()).longValue();
  }
  private Map<String,Object> row(String table, long id) {
    var rows = jdbc.queryForList("SELECT * FROM " + table + " WHERE id=?", id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Registro no encontrado");
    return rows.get(0);
  }
  private long number(Map<String,Object> row, String key) { return ((Number) row.get(key)).longValue(); }
  private Map<String,Object> analysisRow(long id) {
    var rows = jdbc.queryForList("SELECT id,block_id,sampled_on,details,created_by,report_type FROM soil_analysis WHERE id=?",id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Análisis no encontrado");
    var row = rows.get(0); access.require(access.blockFarm(number(row,"block_id")),false); return row;
  }
  private Map<String,Object> planRow(long id, boolean manage, boolean lock) {
    var row = row("fertilization_plan",id); access.require(access.blockFarm(number(row,"block_id")),manage);
    if (lock) return jdbc.queryForMap("SELECT * FROM fertilization_plan WHERE id=? FOR UPDATE",id);
    return row;
  }
  private Map<String,Object> presentAnalysis(Map<String,Object> row) {
    var result = decode((String) row.get("details")); result.put("id",row.get("id")); result.put("createdBy",row.get("created_by"));
    result.put("hasReport",row.get("report_type") != null); return result;
  }
  private Map<String,Object> presentPlan(Map<String,Object> row) {
    var result = decode((String) row.get("details"));
    for (var entry : Map.of("id","id","status","status","version","version","taskId","task_id","totalQuantity","total_quantity","createdBy","created_by","approvedBy","approved_by","approvedAt","approved_at","decisionReason","decision_reason").entrySet()) {
      Object value = row.get(entry.getValue()); result.put(entry.getKey(),value == null ? null : value instanceof java.time.temporal.TemporalAccessor ? value.toString() : value);
    }
    result.put("appliedQuantity",jdbc.queryForObject("SELECT COALESCE(SUM(quantity),0) FROM fertilization_application WHERE plan_id=?",BigDecimal.class,row.get("id")));
    result.put("canceledBy",row.get("canceled_by")); result.put("canceledAt",row.get("canceled_at"));
    result.put("followups",jdbc.queryForList("SELECT id, analysis_id AS \"analysisId\", observations, reviewed_by AS \"reviewedBy\", reviewed_at AS \"reviewedAt\" FROM fertilization_followup WHERE plan_id=? ORDER BY id DESC",row.get("id")));
    return result;
  }
  public Map<String,Object> list(long farmId) {
    access.require(farmId,false);
    var analyses = jdbc.queryForList("SELECT a.id,a.details,a.created_by,a.report_type FROM soil_analysis a JOIN block b ON b.id=a.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY sampled_on DESC,a.id DESC",farmId).stream().map(this::presentAnalysis).toList();
    var plans = jdbc.queryForList("SELECT p.* FROM fertilization_plan p JOIN block b ON b.id=p.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY p.id DESC",farmId).stream().map(this::presentPlan).toList();
    var applications = jdbc.queryForList("SELECT a.* FROM fertilization_application a JOIN fertilization_plan p ON p.id=a.plan_id JOIN block b ON b.id=p.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY a.id DESC",farmId).stream().map(row -> {
      var result = decode((String) row.get("details")); result.put("id",row.get("id")); result.put("planId",row.get("plan_id")); result.put("eventId",row.get("event_id")); result.put("createdBy",row.get("created_by")); return result;
    }).toList();
    return Map.of("analyses",analyses,"plans",plans,"applications",applications);
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
    long id = insert("INSERT INTO soil_analysis(block_id,sampled_on,details,created_by) VALUES (?,?,?,?)",request.blockId(),request.sampledOn(),encode(request),access.userId());
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
      var areas = jdbc.queryForList("SELECT area_ha FROM block WHERE id=?",BigDecimal.class,request.blockId());
      if (areas.get(0)!=null && request.coverage().compareTo(areas.get(0))>0) throw bad("El área supera el bloque");
    }
    if (request.inspectionId()!=null) {
      var inspection = row("phytosanitary_inspection",request.inspectionId());
      if (number(inspection,"block_id")!=request.blockId() || inspection.get("canceled_at")!=null) throw bad("La inspección debe estar vigente y pertenecer al bloque");
    }
    if (jdbc.queryForObject("SELECT COUNT(*) FROM farm_membership WHERE farm_id=? AND user_id=?",Integer.class,farmId,request.assigneeId())!=1) throw bad("El responsable debe pertenecer a la finca");
    BigDecimal total = total(request); if (total.signum()<=0 || total.precision()-total.scale()>10) throw bad("Cantidad total fuera de rango");
    long id = insert("INSERT INTO fertilization_plan(block_id,analysis_id,inspection_id,details,total_quantity,created_by) VALUES (?,?,?,?,?,?)",request.blockId(),request.analysisId(),request.inspectionId(),encode(request),total,access.userId());
    return presentPlan(planRow(id,true,false));
  }
  @Transactional
  public Map<String,Object> decision(long id, Decision request, boolean approve) {
    var row = planRow(id,true,true);
    if (number(row,"version")!=request.version() || (approve && !"DRAFT".equals(row.get("status"))) || "CANCELED".equals(row.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"El plan cambió o ya fue decidido");
    if (!approve && row.get("task_id")!=null) throw bad("Un plan con tarea no puede anularse; bloquea la tarea y conserva la trazabilidad");
    if (approve) jdbc.update("UPDATE fertilization_plan SET status='APPROVED',version=version+1,decision_reason=?,approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=?",request.reason(),access.userId(),id);
    else jdbc.update("UPDATE fertilization_plan SET status='CANCELED',version=version+1,decision_reason=?,canceled_by=?,canceled_at=CURRENT_TIMESTAMP WHERE id=?",request.reason(),access.userId(),id);
    return presentPlan(planRow(id,true,false));
  }
  @Transactional
  public Map<String,Object> task(long id) {
    var row = planRow(id,true,true);
    if (!"APPROVED".equals(row.get("status"))) throw bad("Aprueba el plan antes de generar tareas");
    if (row.get("task_id")==null) {
      Plan plan = json.convertValue(decode((String) row.get("details")),Plan.class);
      var task = tasks.create(new TaskDtos.CreateRequest(access.blockFarm(plan.blockId()),null,plan.blockId(),plan.assigneeId(),"Fertilización #"+id+" · "+plan.product().substring(0,Math.min(100,plan.product().length())),TaskDtos.Activity.fertilization,plan.scheduledOn(),plan.scheduledTime(),TaskDtos.Priority.Media,
        "Plan aprobado #"+id+". Producto: "+plan.product()+". Composición: "+plan.composition()+". Dosis: "+plan.dose()+" "+plan.doseUnit()+". Cobertura: "+plan.coverage()+". Total: "+row.get("total_quantity")+" "+quantityUnit(plan.doseUnit())+". Método: "+plan.method()+". Seguimiento: "+plan.followUpOn()));
      jdbc.update("UPDATE fertilization_plan SET task_id=?,version=version+1 WHERE id=?",Long.valueOf(task.id()),id);
    }
    return presentPlan(planRow(id,true,false));
  }
  public static String quantityUnit(DoseUnit unit) { return unit==DoseUnit.L_HA || unit==DoseUnit.ML_PLANT ? "L":"kg"; }
  @Transactional
  public Map<String,Object> apply(long id, Application request) {
    var row = planRow(id,false,true);
    if (!"APPROVED".equals(row.get("status")) || row.get("task_id")==null) throw bad("Se requiere un plan aprobado con tarea");
    Plan plan = json.convertValue(decode((String) row.get("details")),Plan.class);
    var task = jdbc.queryForMap("SELECT assignee_id,status FROM farm_task WHERE id=? FOR UPDATE",row.get("task_id"));
    access.require(access.blockFarm(plan.blockId()),false);
    if (number(task,"assignee_id")!=access.userId()) access.require(access.blockFarm(plan.blockId()),true);
    if (!Set.of("pending","progress").contains(task.get("status"))) throw bad("La tarea debe estar pendiente o en progreso");
    if (request.occurredAt().isAfter(Instant.now()) || request.occurredAt().atZone(java.time.ZoneOffset.UTC).toLocalDate().isBefore(json.convertValue(decode((String) analysisRow(plan.analysisId()).get("details")),Analysis.class).sampledOn())) throw bad("Fecha de aplicación inválida");
    if (request.coverage().compareTo(plan.coverage())>0 || ((plan.doseUnit()==DoseUnit.G_PLANT || plan.doseUnit()==DoseUnit.ML_PLANT) && request.coverage().stripTrailingZeros().scale()>0)) throw bad("Cobertura inválida");
    BigDecimal applied = jdbc.queryForObject("SELECT COALESCE(SUM(quantity),0) FROM fertilization_application WHERE plan_id=?",BigDecimal.class,id);
    if (applied.add(request.quantity()).compareTo((BigDecimal) row.get("total_quantity"))>0) throw bad("La cantidad acumulada supera el plan aprobado; requiere un nuevo plan");
    long eventId = insert("INSERT INTO field_event(event_type,occurred_at,created_by_user_id,block_id,notes) VALUES ('FERTILIZER_APPLICATION',?,?,?,?)",java.sql.Timestamp.from(request.occurredAt()),access.userId(),plan.blockId(),"Plan #"+id+" · "+plan.product()+" · "+request.quantity()+" "+quantityUnit(plan.doseUnit())+" · "+Objects.toString(request.notes(),""));
    long applicationId = insert("INSERT INTO fertilization_application(plan_id,event_id,quantity,details,created_by) VALUES (?,?,?,?,?)",id,eventId,request.quantity(),encode(request),access.userId());
    jdbc.update("UPDATE farm_task SET status='progress',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",row.get("task_id"));
    var result = new LinkedHashMap<String,Object>(json.convertValue(request,new TypeReference<Map<String,Object>>() {})); result.put("id",applicationId); result.put("planId",id); result.put("eventId",eventId); result.put("createdBy",access.userId()); return result;
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
    jdbc.update("INSERT INTO fertilization_followup(plan_id,analysis_id,observations,reviewed_by) VALUES (?,?,?,?)",id,request.analysisId(),request.observations(),access.userId());
  }
  @Transactional
  public void report(long id, byte[] data, String type) {
    analysisRow(id);
    if (data.length==0 || data.length>10*1024*1024 || !"application/pdf".equals(type) || data.length<5 || !new String(data,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) throw bad("Adjunta un PDF de laboratorio de hasta 10 MB");
    var sample = analysisRow(id);
    if (number(sample,"created_by")!=access.userId()) access.require(access.blockFarm(number(sample,"block_id")),true);
    if (sample.get("report_type")!=null) throw new ResponseStatusException(HttpStatus.CONFLICT,"El informe ya está adjunto; registra una nueva muestra para corregirlo");
    if (jdbc.update("UPDATE soil_analysis SET report=?,report_type=? WHERE id=? AND report_type IS NULL",data,type,id)!=1) throw new ResponseStatusException(HttpStatus.CONFLICT,"El informe ya fue adjuntado");
  }
  public byte[] report(long id) {
    var row = analysisRow(id); if (row.get("report_type")==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Sin informe adjunto"); return jdbc.queryForObject("SELECT report FROM soil_analysis WHERE id=?",byte[].class,id);
  }
  public Map<String,Object> latestSoil(long blockId) {
    var rows = jdbc.queryForList("SELECT id,details,created_by,report_type FROM soil_analysis WHERE block_id=? ORDER BY sampled_on DESC,id DESC",blockId);
    for (var row : rows) {
      var sample = decode((String) row.get("details"));
      if ("SOIL".equals(sample.get("sampleType"))) return presentAnalysis(row);
    }
    return null;
  }
}
