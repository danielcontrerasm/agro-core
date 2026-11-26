package com.yourco.agro.irrigation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import com.yourco.agro.tasks.TaskDtos;
import com.yourco.agro.tasks.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static com.yourco.agro.irrigation.IrrigationDtos.*;

@Service
public class IrrigationService {
  private final JpaSql queries;
  private final FarmAccess access;
  private final TaskService tasks;
  private final ObjectMapper json;
  public IrrigationService(JpaSql queries, FarmAccess access, TaskService tasks, ObjectMapper json) {
    this.queries=queries; this.access=access; this.tasks=tasks; this.json=json;
  }
  private ResponseStatusException bad(String detail) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,detail); }
  private ResponseStatusException conflict(String detail) { return new ResponseStatusException(HttpStatus.CONFLICT,detail); }
  private void requireVersion(Map<String,Object> row,Long version,String message) {
    if (number(row,"version")!=version) throw conflict(message);
  }
  private String encode(Object value) {
    try { return json.writeValueAsString(value); } catch (Exception exception) { throw new IllegalStateException(exception); }
  }
  private Map<String,Object> decode(Object value) {
    try { return json.readValue((String) value,new TypeReference<LinkedHashMap<String,Object>>() {}); }
    catch (Exception exception) { throw new IllegalStateException(exception); }
  }
  private long number(Map<String,Object> row,String key) { return ((Number) row.get(key)).longValue(); }
  private BigDecimal decimal(Object value) { return new BigDecimal(value.toString()); }
  private Map<String,Object> row(String table,long id) {
    var rows=queries.rows("SELECT * FROM "+table+" WHERE id=?",id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Registro de riego no encontrado"); return rows.get(0);
  }
  private Map<String,Object> sector(long id,boolean manage,boolean lock) {
    var row=row("irrigation_sector",id); access.require(access.blockFarm(number(row,"block_id")),manage);
    return lock ? queries.row("SELECT * FROM irrigation_sector WHERE id=? FOR UPDATE",id) : row;
  }
  private Map<String,Object> plan(long id,boolean manage,boolean lock) {
    var row=row("irrigation_plan",id); sector(number(row,"sector_id"),manage,false);
    return lock ? queries.row("SELECT * FROM irrigation_plan WHERE id=? FOR UPDATE",id) : row;
  }
  private Map<String,Object> present(Map<String,Object> row) {
    var value=decode(row.get("details")); value.put("id",row.get("id")); value.put("createdBy",row.get("created_by")); value.put("createdAt",row.get("created_at").toString()); return value;
  }
  private Map<String,Object> presentSector(Map<String,Object> row) {
    var value=present(row); value.put("version",row.get("version")); return value;
  }
  private List<Map<String,Object>> measurements(Map<String,Object> sectorRow) {
    long id=number(sectorRow,"id");
    var result=new ArrayList<Map<String,Object>>();
    for (var row : queries.rows("SELECT * FROM irrigation_measurement WHERE sector_id=? ORDER BY recorded_at DESC,id DESC LIMIT 200",id)) {
      var value=present(row); value.put("source","MANUAL"); result.add(value);
    }
    if (sectorRow.get("sensor_device_id")!=null) {
      var config=decode(sectorRow.get("details"));
      for (var row : queries.rows("SELECT r.* FROM sensor_reading r JOIN sensor_device d ON d.id=r.device_id WHERE r.device_id=? AND d.active=TRUE AND r.soil_moisture IS NOT NULL AND r.recorded_at>=? AND r.recorded_at<=CURRENT_TIMESTAMP ORDER BY r.recorded_at DESC,r.id DESC LIMIT 100",sectorRow.get("sensor_device_id"),sectorRow.get("created_at"))) {
        double moisture=((Number) row.get("soil_moisture")).doubleValue();
        if (!Double.isFinite(moisture) || moisture<0 || (!"KPA".equals(config.get("unit")) && moisture>100)) continue;
        var value=new LinkedHashMap<String,Object>(); value.put("id","sensor-"+id+"-"+row.get("id")); value.put("sectorId",id); value.put("recordedAt",instant(row.get("recorded_at")).toString());
        value.put("value",moisture); value.put("source","SENSOR"); value.put("unit",config.get("unit")); value.put("depthCm",config.get("depthCm")); value.put("instrument","Sensor #"+sectorRow.get("sensor_device_id")); result.add(value);
      }
    }
    result.sort(Comparator.comparing((Map<String,Object> value) -> Instant.parse(value.get("recordedAt").toString())).reversed()); return result;
  }
  private Instant instant(Object value) {
    if (value instanceof OffsetDateTime time) return time.toInstant();
    if (value instanceof Timestamp time) return time.toInstant();
    return Instant.parse(value.toString());
  }
  public static String condition(Map<String,Object> config,Map<String,Object> latest,Instant now) {
    if (latest==null) return "NO_DATA";
    if (Instant.parse(latest.get("recordedAt").toString()).plusSeconds(((Number) config.get("maxAgeHours")).longValue()*3600).isBefore(now)) return "STALE";
    if (config.get("lowerBound")==null || config.get("upperBound")==null) return "UNCONFIGURED";
    BigDecimal value=new BigDecimal(latest.get("value").toString());
    return value.compareTo(new BigDecimal(config.get("lowerBound").toString()))<0 ? "BELOW_RANGE" : value.compareTo(new BigDecimal(config.get("upperBound").toString()))>0 ? "ABOVE_RANGE" : "IN_RANGE";
  }
  private Map<String,Object> sectorStatus(Map<String,Object> row) {
    var value=presentSector(row); var readings=measurements(row); var latest=readings.isEmpty()?null:readings.get(0);
    value.put("latest",latest); value.put("condition",condition(value,latest,Instant.now()));
    if (row.get("sensor_device_id")!=null) {
      var sensorLatest=readings.stream().filter(reading -> "SENSOR".equals(reading.get("source"))).findFirst().orElse(null);
      value.put("sensorCondition",condition(value,sensorLatest,Instant.now()));
    }
    return value;
  }
  public List<Map<String,Object>> forBlock(long blockId) {
    access.require(access.blockFarm(blockId),false);
    return queries.rows("SELECT * FROM irrigation_sector WHERE block_id=? ORDER BY id",blockId).stream().map(this::sectorStatus).toList();
  }
  private Map<String,Object> presentPlan(Map<String,Object> row) {
    var value=present(row); value.put("version",row.get("version")); value.put("taskId",row.get("task_id")); value.put("status",row.get("status"));
    value.put("recurringScheduleId",row.get("recurring_schedule_id")); value.put("occurrenceOn",row.get("occurrence_on"));
    value.put("canceledBy",row.get("canceled_by")); value.put("cancelReason",row.get("cancel_reason")); value.put("canceledAt",row.get("canceled_at"));
    value.put("actualVolumeM3",queries.value("SELECT COALESCE(SUM(volume_m3),0) FROM irrigation_execution WHERE plan_id=?",BigDecimal.class,row.get("id")));
    value.put("actualDurationMinutes",queries.value("SELECT COALESCE(SUM(duration_minutes),0) FROM irrigation_execution WHERE plan_id=?",BigDecimal.class,row.get("id")));
    if (row.get("task_id")!=null) value.put("taskStatus",queries.value("SELECT status FROM farm_task WHERE id=?",String.class,row.get("task_id")));
    return value;
  }
  private long scheduleFarm(Map<String,Object> row) {
    return queries.value("SELECT f.farm_id FROM irrigation_sector s JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id WHERE s.id=?",Long.class,row.get("sector_id"));
  }
  private Map<String,Object> recurringSchedule(long id,boolean manage,boolean lock) {
    var current=row("irrigation_recurring_schedule",id); access.require(scheduleFarm(current),manage);
    return lock ? queries.row("SELECT * FROM irrigation_recurring_schedule WHERE id=? FOR UPDATE",id) : current;
  }
  private LocalDate localDate(Object value) {
    if (value instanceof LocalDate date) return date;
    if (value instanceof java.sql.Date date) return date.toLocalDate();
    return LocalDate.parse(value.toString());
  }
  private LocalTime localTime(Object value) {
    if (value instanceof LocalTime time) return time;
    if (value instanceof java.sql.Time time) return time.toLocalTime();
    return LocalTime.parse(value.toString());
  }
  private void validateRecurringDates(LocalDate startDate,LocalDate endDate) {
    if (endDate.isBefore(startDate)) throw bad("La fecha final debe ser igual o posterior a la fecha inicial");
    if (startDate.plusDays(730).isBefore(endDate)) throw bad("La recurrencia no puede superar dos años");
  }
  private void validateRecurringWindow(LocalDate from,LocalDate until) {
    if (until.isBefore(from)) throw bad("El final de la ventana debe ser posterior al inicio");
    if (from.plusDays(366).isBefore(until)) throw bad("La ventana de generación no puede superar 366 días");
  }
  private void validateAssignee(long farmId,long assigneeId) {
    if (queries.value("SELECT COUNT(*) FROM farm_membership WHERE farm_id=? AND user_id=?",Integer.class,farmId,assigneeId)!=1) throw bad("El responsable debe pertenecer a la finca");
  }
  private LocalDate nextDate(Map<String,Object> schedule,LocalDate date) {
    int interval=((Number) schedule.get("recurrence_interval")).intValue();
    return "WEEKLY".equals(schedule.get("recurrence_unit")) ? date.plusWeeks(interval) : date.plusDays(interval);
  }
  private List<LocalDate> occurrenceDates(Map<String,Object> schedule,LocalDate from,LocalDate until) {
    if (until.isBefore(from)) return List.of();
    LocalDate start=localDate(schedule.get("start_date")); LocalDate end=localDate(schedule.get("end_date"));
    LocalDate cursor=start; while (cursor.isBefore(from) && !cursor.isAfter(end)) cursor=nextDate(schedule,cursor);
    var dates=new ArrayList<LocalDate>();
    while (!cursor.isAfter(until) && !cursor.isAfter(end)) { if (!cursor.isBefore(from)) dates.add(cursor); cursor=nextDate(schedule,cursor); }
    return dates;
  }
  private List<Map<String,Object>> preview(Map<String,Object> schedule,LocalDate from,LocalDate until) {
    var result=new ArrayList<Map<String,Object>>();
    for (var date: occurrenceDates(schedule,from,until)) {
      var value=new LinkedHashMap<String,Object>(); value.put("date",date.toString());
      var generated=queries.rows("SELECT id,task_id,status FROM irrigation_plan WHERE recurring_schedule_id=? AND occurrence_on=?",schedule.get("id"),date).stream().findFirst().orElse(null);
      value.put("generated",generated!=null); value.put("planId",generated==null?null:generated.get("id")); value.put("taskId",generated==null?null:generated.get("task_id")); value.put("status",generated==null?null:generated.get("status")); result.add(value);
    }
    return result;
  }
  private Map<String,Object> presentRecurringSchedule(Map<String,Object> row) {
    var value=new LinkedHashMap<String,Object>();
    value.put("id",row.get("id")); value.put("sectorId",row.get("sector_id")); value.put("startDate",row.get("start_date")); value.put("endDate",row.get("end_date"));
    value.put("scheduledTime",row.get("scheduled_time")); value.put("recurrenceUnit",row.get("recurrence_unit")); value.put("recurrenceInterval",row.get("recurrence_interval"));
    value.put("durationMinutes",row.get("duration_minutes")); value.put("volumeM3",row.get("volume_m3")); value.put("assigneeId",row.get("assignee_id"));
    value.put("justification",row.get("justification")); value.put("instructions",row.get("instructions")); value.put("status",row.get("status")); value.put("version",row.get("version"));
    value.put("createdBy",row.get("created_by")); value.put("createdAt",row.get("created_at")); value.put("cancelReason",row.get("cancel_reason")); value.put("canceledAt",row.get("canceled_at"));
    var upcoming=preview(row,LocalDate.now(),LocalDate.now().plusDays(30)); value.put("upcoming",upcoming);
    value.put("nextOccurrence",upcoming.stream().filter(item -> !Boolean.TRUE.equals(item.get("generated"))).map(item -> item.get("date")).findFirst().orElse(null));
    value.put("generatedCount",queries.value("SELECT COUNT(*) FROM irrigation_plan WHERE recurring_schedule_id=?",Integer.class,row.get("id")));
    value.put("taskCount",queries.value("SELECT COUNT(*) FROM irrigation_plan WHERE recurring_schedule_id=? AND task_id IS NOT NULL",Integer.class,row.get("id")));
    value.put("historyCount",queries.value("SELECT COUNT(*) FROM irrigation_recurring_schedule_history WHERE schedule_id=?",Integer.class,row.get("id")));
    return value;
  }
  private void history(long scheduleId,String action,String details,long userId) {
    queries.execute("INSERT INTO irrigation_recurring_schedule_history(schedule_id,action,details,created_by) VALUES (?,?,?,?)",scheduleId,action,details,userId);
  }
  private long recurringTask(Map<String,Object> schedule,Map<String,Object> sector,LocalDate date) {
    long farmId=scheduleFarm(schedule); long blockId=number(sector,"block_id"); validateAssignee(farmId,number(schedule,"assignee_id"));
    var config=decode(sector.get("details")); String name=Objects.toString(config.get("name"),"Sector "+blockId);
    String title="Riego recurrente #"+schedule.get("id")+" · "+name; String instructions="Programación recurrente #"+schedule.get("id")+". Duración: "+schedule.get("duration_minutes")+" min. Volumen: "+schedule.get("volume_m3")+" m³. "+schedule.get("instructions")+". Justificación: "+schedule.get("justification");
    return queries.insert("INSERT INTO farm_task(farm_id,field_id,block_id,assignee_id,title,activity,scheduled_date,scheduled_time,priority,instructions,created_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",farmId,null,blockId,number(schedule,"assignee_id"),title,"irrigation",date,localTime(schedule.get("scheduled_time")),"Media",instructions,number(schedule,"created_by"));
  }
  private int generateLocked(Map<String,Object> schedule,LocalDate from,LocalDate until,long actorId) {
    if (!"ACTIVE".equals(schedule.get("status"))) throw bad("La recurrencia debe estar activa para generar tareas");
    validateRecurringWindow(from,until); int created=0; var planIds=new ArrayList<Long>();
    for (var date: occurrenceDates(schedule,from,until)) {
      if (queries.value("SELECT COUNT(*) FROM irrigation_plan WHERE recurring_schedule_id=? AND occurrence_on=?",Integer.class,schedule.get("id"),date)>0) continue;
      var sector=queries.row("SELECT * FROM irrigation_sector WHERE id=?",schedule.get("sector_id"));
      var plan=new Plan(number(sector,"id"),date,localTime(schedule.get("scheduled_time")),decimal(schedule.get("duration_minutes")),decimal(schedule.get("volume_m3")),number(schedule,"assignee_id"),Objects.toString(schedule.get("justification")),Objects.toString(schedule.get("instructions")));
      var details=json.convertValue(plan,new TypeReference<LinkedHashMap<String,Object>>() {}); details.put("sectorSnapshot",sectorStatus(sector));
      long planId=queries.insert("INSERT INTO irrigation_plan(sector_id,details,recurring_schedule_id,occurrence_on,created_by) VALUES (?,?,?,?,?)",number(sector,"id"),encode(details),schedule.get("id"),date,schedule.get("created_by"));
      long taskId=recurringTask(schedule,sector,date); queries.execute("UPDATE irrigation_plan SET task_id=?,version=version+1 WHERE id=?",taskId,planId);
      planIds.add(planId); created++;
    }
    if (created>0) { var details=new LinkedHashMap<String,Object>(); details.put("from",from); details.put("until",until); details.put("planIds",planIds); history(number(schedule,"id"),"GENERATED",encode(details),actorId); }
    return created;
  }
  private Map<String,Object> presentExecution(Map<String,Object> row) {
    var value=present(row); value.put("planId",row.get("plan_id")); value.put("eventId",row.get("event_id")); value.put("volumeM3",row.get("volume_m3")); value.put("durationMinutes",row.get("duration_minutes")); return value;
  }
  public Map<String,Object> list(long farmId) {
    access.require(farmId,false);
    var sectors=queries.rows("SELECT s.* FROM irrigation_sector s JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY s.id",farmId);
    var plans=queries.rows("SELECT p.* FROM irrigation_plan p JOIN irrigation_sector s ON s.id=p.sector_id JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY p.id DESC",farmId).stream().map(this::presentPlan).toList();
    var executions=queries.rows("SELECT e.* FROM irrigation_execution e JOIN irrigation_plan p ON p.id=e.plan_id JOIN irrigation_sector s ON s.id=p.sector_id JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY e.started_at DESC,e.id DESC",farmId).stream().map(this::presentExecution).toList();
    var sources=queries.rows("SELECT id,farm_id AS \"farmId\",name,source_type AS \"sourceType\",latitude,longitude,capacity_m3 AS \"capacityM3\",active,notes,version,created_by AS \"createdBy\",created_at AS \"createdAt\" FROM irrigation_water_source WHERE farm_id=? ORDER BY name",farmId);
    var quality=queries.rows("SELECT q.id,q.source_id AS \"sourceId\",q.sampled_on AS \"sampledOn\",q.ph,q.conductivity_ds_m AS \"conductivityDsM\",q.salinity_ppm AS \"salinityPpm\",q.suspended_solids_mg_l AS \"suspendedSolidsMgL\",q.laboratory_reference AS \"laboratoryReference\",q.notes,q.version,q.created_by AS \"createdBy\",q.created_at AS \"createdAt\" FROM irrigation_water_quality q JOIN irrigation_water_source s ON s.id=q.source_id WHERE s.farm_id=? ORDER BY q.sampled_on DESC,q.id DESC",farmId);
    var infrastructure=queries.rows("SELECT id,farm_id AS \"farmId\",block_id AS \"blockId\",source_id AS \"sourceId\",asset_type AS \"assetType\",code,latitude,longitude,status,notes,version,created_by AS \"createdBy\",created_at AS \"createdAt\" FROM irrigation_infrastructure WHERE farm_id=? ORDER BY code",farmId);
    var balances=queries.rows("SELECT b.id,b.sector_id AS \"sectorId\",b.balance_date AS \"balanceDate\",b.rainfall_mm AS \"rainfallMm\",b.et0_mm AS \"et0Mm\",b.crop_coefficient AS \"cropCoefficient\",b.root_depth_cm AS \"rootDepthCm\",b.available_water_mm AS \"availableWaterMm\",b.required_volume_m3 AS \"requiredVolumeM3\",b.applied_volume_m3 AS \"appliedVolumeM3\",b.deficit_mm AS \"deficitMm\",b.notes,b.version,b.created_by AS \"createdBy\",b.created_at AS \"createdAt\" FROM irrigation_water_balance b JOIN irrigation_sector s ON s.id=b.sector_id JOIN block bl ON bl.id=s.block_id JOIN field f ON f.id=bl.field_id WHERE f.farm_id=? ORDER BY b.balance_date DESC,b.id DESC",farmId);
    var maintenance=queries.rows("SELECT m.id,m.sector_id AS \"sectorId\",m.infrastructure_id AS \"infrastructureId\",m.maintenance_type AS \"maintenanceType\",m.scheduled_on AS \"scheduledOn\",m.completed_on AS \"completedOn\",m.status,m.pressure_kpa AS \"pressureKpa\",m.flow_m3h AS \"flowM3h\",m.notes,m.task_id AS \"taskId\",m.version,m.created_by AS \"createdBy\",m.created_at AS \"createdAt\" FROM irrigation_maintenance m LEFT JOIN irrigation_sector s ON s.id=m.sector_id LEFT JOIN block bl ON bl.id=s.block_id LEFT JOIN field f ON f.id=bl.field_id LEFT JOIN irrigation_infrastructure i ON i.id=m.infrastructure_id WHERE COALESCE(f.farm_id,i.farm_id)=? ORDER BY m.scheduled_on DESC,m.id DESC",farmId);
    var sensorChecks=queries.rows("SELECT c.id,c.sector_id AS \"sectorId\",c.sensor_device_id AS \"sensorDeviceId\",c.checked_on AS \"checkedOn\",c.calibration_status AS \"calibrationStatus\",c.reference_value AS \"referenceValue\",c.observed_value AS \"observedValue\",c.technician,c.notes,c.version,c.created_by AS \"createdBy\",c.created_at AS \"createdAt\" FROM irrigation_sensor_check c JOIN irrigation_sector s ON s.id=c.sector_id JOIN block bl ON bl.id=s.block_id JOIN field f ON f.id=bl.field_id WHERE f.farm_id=? ORDER BY c.checked_on DESC,c.id DESC",farmId);
    var recurringSchedules=queries.rows("SELECT r.* FROM irrigation_recurring_schedule r JOIN irrigation_sector s ON s.id=r.sector_id JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=? ORDER BY CASE r.status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 ELSE 2 END,r.start_date,r.id",farmId).stream().map(this::presentRecurringSchedule).toList();
    var result=new LinkedHashMap<String,Object>(); result.put("sectors",sectors.stream().map(this::sectorStatus).toList()); result.put("measurements",sectors.stream().flatMap(row -> measurements(row).stream()).toList()); result.put("plans",plans); result.put("executions",executions); result.put("recurringSchedules",recurringSchedules); result.put("waterSources",sources); result.put("waterQuality",quality); result.put("infrastructure",infrastructure); result.put("waterBalances",balances); result.put("maintenance",maintenance); result.put("sensorChecks",sensorChecks); return result;
  }

  @Transactional public Map<String,Object> createRecurringSchedule(RecurringSchedule request) {
    var sector=sector(request.sectorId(),true,false); long farmId=access.blockFarm(number(sector,"block_id")); validateRecurringDates(request.startDate(),request.endDate()); validateAssignee(farmId,request.assigneeId());
    long id=queries.insert("INSERT INTO irrigation_recurring_schedule(sector_id,start_date,end_date,scheduled_time,recurrence_unit,recurrence_interval,duration_minutes,volume_m3,assignee_id,justification,instructions,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",request.sectorId(),request.startDate(),request.endDate(),request.scheduledTime(),request.recurrenceUnit().name(),request.recurrenceInterval(),request.durationMinutes(),request.volumeM3(),request.assigneeId(),request.justification().trim(),request.instructions().trim(),access.userId());
    var current=row("irrigation_recurring_schedule",id); history(id,"CREATED",encode(request),access.userId());
    if (!request.endDate().isBefore(LocalDate.now())) generateLocked(current,LocalDate.now(),LocalDate.now().plusDays(30),access.userId());
    return presentRecurringSchedule(row("irrigation_recurring_schedule",id));
  }
  @Transactional public Map<String,Object> updateRecurringSchedule(long id,RecurringScheduleUpdate request) {
    var current=recurringSchedule(id,true,true); if ("CANCELED".equals(current.get("status"))) throw bad("La recurrencia está anulada");
    var target=sector(request.sectorId(),true,false); long currentFarm=scheduleFarm(current); if (access.blockFarm(number(target,"block_id"))!=currentFarm) throw bad("El sector no pertenece a la finca");
    validateRecurringDates(request.startDate(),request.endDate()); validateAssignee(currentFarm,request.assigneeId()); requireVersion(current,request.version(),"La recurrencia cambió; actualiza la vista");
    int changed=queries.execute("UPDATE irrigation_recurring_schedule SET sector_id=?,start_date=?,end_date=?,scheduled_time=?,recurrence_unit=?,recurrence_interval=?,duration_minutes=?,volume_m3=?,assignee_id=?,justification=?,instructions=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?",request.sectorId(),request.startDate(),request.endDate(),request.scheduledTime(),request.recurrenceUnit().name(),request.recurrenceInterval(),request.durationMinutes(),request.volumeM3(),request.assigneeId(),request.justification().trim(),request.instructions().trim(),id,request.version());
    if (changed==0) throw conflict("La recurrencia cambió; actualiza la vista"); history(id,"UPDATED",encode(request),access.userId()); return presentRecurringSchedule(row("irrigation_recurring_schedule",id));
  }
  @Transactional public Map<String,Object> generateRecurringSchedule(long id,LocalDate from,LocalDate until) {
    var current=recurringSchedule(id,true,true); LocalDate start=from==null?LocalDate.now():from; LocalDate end=until==null?start.plusDays(30):until; int created=generateLocked(current,start,end,access.userId());
    var result=presentRecurringSchedule(row("irrigation_recurring_schedule",id)); result.put("generatedNow",created); return result;
  }
  @Transactional public Map<String,Object> changeRecurringScheduleStatus(long id,String status,RecurringScheduleAction request) {
    var current=recurringSchedule(id,true,true); requireVersion(current,request.version(),"La recurrencia cambió; actualiza la vista"); String previous=Objects.toString(current.get("status"));
    if ("CANCELED".equals(previous) || previous.equals(status)) throw bad("El estado de la recurrencia no permite ese cambio");
    if ("CANCELED".equals(status) && (request.reason()==null || request.reason().isBlank())) throw bad("Documenta el motivo de anulación");
    String reason="CANCELED".equals(status)?request.reason().trim():null; int changed=queries.execute("UPDATE irrigation_recurring_schedule SET status=?,version=version+1,cancel_reason=?,canceled_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?",status,reason,"CANCELED".equals(status)?Instant.now():null,id,request.version());
    if (changed==0) throw conflict("La recurrencia cambió; actualiza la vista"); history(id,"PAUSED".equals(status)?"PAUSED":"ACTIVE".equals(status)?"RESUMED":"CANCELED",encode(request),access.userId()); return presentRecurringSchedule(row("irrigation_recurring_schedule",id));
  }
  public List<Map<String,Object>> previewRecurringSchedule(long id,LocalDate from,LocalDate until) {
    var current=recurringSchedule(id,false,false); LocalDate start=from==null?LocalDate.now():from; LocalDate end=until==null?start.plusDays(30):until; validateRecurringWindow(start,end); return preview(current,start,end);
  }
  public List<Map<String,Object>> recurringScheduleHistory(long id) {
    recurringSchedule(id,false,false); return queries.rows("SELECT id,schedule_id AS \"scheduleId\",action,details,created_by AS \"createdBy\",created_at AS \"createdAt\" FROM irrigation_recurring_schedule_history WHERE schedule_id=? ORDER BY created_at DESC,id DESC",id);
  }
  public List<Long> activeRecurringScheduleIds() { return queries.values("SELECT id FROM irrigation_recurring_schedule WHERE status='ACTIVE' AND end_date>=? ORDER BY id",Long.class,LocalDate.now()); }
  @Transactional public void generateRecurringAutomatically(long id,LocalDate from,LocalDate until) {
    var current=queries.row("SELECT * FROM irrigation_recurring_schedule WHERE id=? FOR UPDATE",id); if ("ACTIVE".equals(current.get("status"))) generateLocked(current,from,until,number(current,"created_by"));
  }

  @Transactional public Map<String,Object> createWaterSource(WaterSource request) {
    access.require(request.farmId(),true);
    long id=queries.insert("INSERT INTO irrigation_water_source(farm_id,name,source_type,latitude,longitude,capacity_m3,notes,created_by) VALUES (?,?,?,?,?,?,?,?)",request.farmId(),request.name().trim(),request.sourceType().name(),request.latitude(),request.longitude(),request.capacityM3(),request.notes(),access.userId());
    return row("irrigation_water_source",id);
  }
  @Transactional public Map<String,Object> updateWaterSource(long id,WaterSourceUpdate request) {
    var current=row("irrigation_water_source",id); access.require(number(current,"farm_id"),true);
    requireVersion(current,request.version(),"La fuente de agua cambió; actualiza la vista");
    int changed=queries.execute("UPDATE irrigation_water_source SET name=?,source_type=?,latitude=?,longitude=?,capacity_m3=?,active=?,notes=?,version=version+1 WHERE id=? AND version=?",
      request.name().trim(),request.sourceType().name(),request.latitude(),request.longitude(),request.capacityM3(),request.active(),request.notes(),id,request.version());
    if (changed==0) throw conflict("La fuente de agua cambió; actualiza la vista");
    return row("irrigation_water_source",id);
  }
  @Transactional public Map<String,Object> addWaterQuality(long sourceId,WaterQuality request) {
    var source=row("irrigation_water_source",sourceId); access.require(number(source,"farm_id"),true);
    long id=queries.insert("INSERT INTO irrigation_water_quality(source_id,sampled_on,ph,conductivity_ds_m,salinity_ppm,suspended_solids_mg_l,laboratory_reference,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)",sourceId,request.sampledOn(),request.ph(),request.conductivityDsM(),request.salinityPpm(),request.suspendedSolidsMgL(),request.laboratoryReference(),request.notes(),access.userId());
    return row("irrigation_water_quality",id);
  }
  @Transactional public Map<String,Object> updateWaterQuality(long id,WaterQualityUpdate request) {
    var current=row("irrigation_water_quality",id); var currentSource=row("irrigation_water_source",number(current,"source_id"));
    access.require(number(currentSource,"farm_id"),true);
    var source=row("irrigation_water_source",request.sourceId());
    if (number(source,"farm_id")!=number(currentSource,"farm_id")) throw bad("La fuente no pertenece a la finca");
    requireVersion(current,request.version(),"El análisis de calidad cambió; actualiza la vista");
    int changed=queries.execute("UPDATE irrigation_water_quality SET source_id=?,sampled_on=?,ph=?,conductivity_ds_m=?,salinity_ppm=?,suspended_solids_mg_l=?,laboratory_reference=?,notes=?,version=version+1 WHERE id=? AND version=?",
      request.sourceId(),request.sampledOn(),request.ph(),request.conductivityDsM(),request.salinityPpm(),request.suspendedSolidsMgL(),request.laboratoryReference(),request.notes(),id,request.version());
    if (changed==0) throw conflict("El análisis de calidad cambió; actualiza la vista");
    return row("irrigation_water_quality",id);
  }
  @Transactional public Map<String,Object> createInfrastructure(Infrastructure request) {
    access.require(request.farmId(),true);
    if (request.blockId()!=null && access.blockFarm(request.blockId())!=request.farmId()) throw bad("El bloque no pertenece a la finca");
    if (request.sourceId()!=null && number(row("irrigation_water_source",request.sourceId()),"farm_id")!=request.farmId()) throw bad("La fuente no pertenece a la finca");
    long id=queries.insert("INSERT INTO irrigation_infrastructure(farm_id,block_id,source_id,asset_type,code,latitude,longitude,status,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",request.farmId(),request.blockId(),request.sourceId(),request.assetType().name(),request.code().trim(),request.latitude(),request.longitude(),request.status().name(),request.notes(),access.userId());
    return row("irrigation_infrastructure",id);
  }
  @Transactional public Map<String,Object> updateInfrastructure(long id,InfrastructureUpdate request) {
    var current=row("irrigation_infrastructure",id); long farmId=number(current,"farm_id"); access.require(farmId,true);
    if (request.blockId()!=null && access.blockFarm(request.blockId())!=farmId) throw bad("El bloque no pertenece a la finca");
    if (request.sourceId()!=null && number(row("irrigation_water_source",request.sourceId()),"farm_id")!=farmId) throw bad("La fuente no pertenece a la finca");
    if (queries.value("SELECT COUNT(*) FROM irrigation_infrastructure WHERE farm_id=? AND code=? AND id<>?",Integer.class,farmId,request.code().trim(),id)>0) throw conflict("Ya existe otro activo con ese código en la finca");
    requireVersion(current,request.version(),"La infraestructura cambió; actualiza la vista");
    int changed=queries.execute("UPDATE irrigation_infrastructure SET block_id=?,source_id=?,asset_type=?,code=?,latitude=?,longitude=?,status=?,notes=?,version=version+1 WHERE id=? AND version=?",
      request.blockId(),request.sourceId(),request.assetType().name(),request.code().trim(),request.latitude(),request.longitude(),request.status().name(),request.notes(),id,request.version());
    if (changed==0) throw conflict("La infraestructura cambió; actualiza la vista");
    return row("irrigation_infrastructure",id);
  }
  @Transactional public Map<String,Object> addBalance(WaterBalance request) {
    var sector=sector(request.sectorId(),true,false);
    if (request.deficitMm()==null && request.requiredVolumeM3()!=null && request.appliedVolumeM3()!=null) {
      request=new WaterBalance(request.sectorId(),request.balanceDate(),request.rainfallMm(),request.et0Mm(),request.cropCoefficient(),request.rootDepthCm(),request.availableWaterMm(),request.requiredVolumeM3(),request.appliedVolumeM3(),request.requiredVolumeM3().subtract(request.appliedVolumeM3()),request.notes());
    }
    long id=queries.insert("INSERT INTO irrigation_water_balance(sector_id,balance_date,rainfall_mm,et0_mm,crop_coefficient,root_depth_cm,available_water_mm,required_volume_m3,applied_volume_m3,deficit_mm,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",request.sectorId(),request.balanceDate(),request.rainfallMm(),request.et0Mm(),request.cropCoefficient(),request.rootDepthCm(),request.availableWaterMm(),request.requiredVolumeM3(),request.appliedVolumeM3(),request.deficitMm(),request.notes(),access.userId());
    return row("irrigation_water_balance",id);
  }
  @Transactional public Map<String,Object> updateBalance(long id,WaterBalanceUpdate request) {
    var current=row("irrigation_water_balance",id); var currentSector=sector(number(current,"sector_id"),true,false);
    var targetSector=sector(request.sectorId(),true,false);
    if (access.blockFarm(number(currentSector,"block_id"))!=access.blockFarm(number(targetSector,"block_id"))) throw bad("El sector no pertenece a la finca");
    if (queries.value("SELECT COUNT(*) FROM irrigation_water_balance WHERE sector_id=? AND balance_date=? AND id<>?",Integer.class,request.sectorId(),request.balanceDate(),id)>0) throw conflict("Ya existe un balance para ese sector y fecha");
    requireVersion(current,request.version(),"El balance hídrico cambió; actualiza la vista");
    var deficit=request.deficitMm();
    if (deficit==null && request.requiredVolumeM3()!=null && request.appliedVolumeM3()!=null) deficit=request.requiredVolumeM3().subtract(request.appliedVolumeM3());
    int changed=queries.execute("UPDATE irrigation_water_balance SET sector_id=?,balance_date=?,rainfall_mm=?,et0_mm=?,crop_coefficient=?,root_depth_cm=?,available_water_mm=?,required_volume_m3=?,applied_volume_m3=?,deficit_mm=?,notes=?,version=version+1 WHERE id=? AND version=?",
      request.sectorId(),request.balanceDate(),request.rainfallMm(),request.et0Mm(),request.cropCoefficient(),request.rootDepthCm(),request.availableWaterMm(),request.requiredVolumeM3(),request.appliedVolumeM3(),deficit,request.notes(),id,request.version());
    if (changed==0) throw conflict("El balance hídrico cambió; actualiza la vista");
    return row("irrigation_water_balance",id);
  }
  @Transactional public Map<String,Object> addMaintenance(Maintenance request) {
    if ((request.sectorId()==null)==(request.infrastructureId()==null)) throw bad("Selecciona un sector o una infraestructura");
    long farmId;
    if (request.sectorId()!=null) farmId=access.blockFarm(number(row("irrigation_sector",request.sectorId()),"block_id"));
    else farmId=number(row("irrigation_infrastructure",request.infrastructureId()),"farm_id");
    access.require(farmId,true);
    if (request.completedOn()!=null && request.completedOn().isBefore(request.scheduledOn())) throw bad("La fecha de finalización no puede ser anterior a la programada");
    long id=queries.insert("INSERT INTO irrigation_maintenance(sector_id,infrastructure_id,maintenance_type,scheduled_on,completed_on,status,pressure_kpa,flow_m3h,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",request.sectorId(),request.infrastructureId(),request.maintenanceType().name(),request.scheduledOn(),request.completedOn(),request.status().name(),request.pressureKpa(),request.flowM3h(),request.notes(),access.userId());
    return row("irrigation_maintenance",id);
  }
  @Transactional public Map<String,Object> updateMaintenance(long id,MaintenanceUpdate request) {
    if ((request.sectorId()==null)==(request.infrastructureId()==null)) throw bad("Selecciona un sector o una infraestructura");
    var current=row("irrigation_maintenance",id); long currentFarm;
    if (current.get("sector_id")!=null) currentFarm=access.blockFarm(number(row("irrigation_sector",number(current,"sector_id")),"block_id"));
    else currentFarm=number(row("irrigation_infrastructure",number(current,"infrastructure_id")),"farm_id");
    access.require(currentFarm,true);
    if (request.sectorId()!=null) {
      var targetSector=sector(request.sectorId(),true,false);
      if (access.blockFarm(number(targetSector,"block_id"))!=currentFarm) throw bad("El sector no pertenece a la finca");
    } else if (number(row("irrigation_infrastructure",request.infrastructureId()),"farm_id")!=currentFarm) throw bad("La infraestructura no pertenece a la finca");
    if (request.completedOn()!=null && request.completedOn().isBefore(request.scheduledOn())) throw bad("La fecha de finalización no puede ser anterior a la programada");
    requireVersion(current,request.version(),"El mantenimiento cambió; actualiza la vista");
    int changed=queries.execute("UPDATE irrigation_maintenance SET sector_id=?,infrastructure_id=?,maintenance_type=?,scheduled_on=?,completed_on=?,status=?,pressure_kpa=?,flow_m3h=?,notes=?,version=version+1 WHERE id=? AND version=?",
      request.sectorId(),request.infrastructureId(),request.maintenanceType().name(),request.scheduledOn(),request.completedOn(),request.status().name(),request.pressureKpa(),request.flowM3h(),request.notes(),id,request.version());
    if (changed==0) throw conflict("El mantenimiento cambió; actualiza la vista");
    return row("irrigation_maintenance",id);
  }
  @Transactional public Map<String,Object> addSensorCheck(SensorCheck request) {
    var sector=sector(request.sectorId(),true,false);
    var sensor=row("sensor_device",request.sensorDeviceId());
    if (!request.sensorDeviceId().equals(sector.get("sensor_device_id")) || number(sensor,"farm_id")!=access.blockFarm(number(sector,"block_id"))) throw bad("El sensor no está asociado al sector y finca");
    long id=queries.insert("INSERT INTO irrigation_sensor_check(sector_id,sensor_device_id,checked_on,calibration_status,reference_value,observed_value,technician,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)",request.sectorId(),request.sensorDeviceId(),request.checkedOn(),request.calibrationStatus().name(),request.referenceValue(),request.observedValue(),request.technician(),request.notes(),access.userId());
    return row("irrigation_sensor_check",id);
  }
  @Transactional public Map<String,Object> updateSensorCheck(long id,SensorCheckUpdate request) {
    var current=row("irrigation_sensor_check",id); var currentSector=sector(number(current,"sector_id"),true,false);
    var targetSector=sector(request.sectorId(),true,false); var sensor=row("sensor_device",request.sensorDeviceId());
    if (access.blockFarm(number(currentSector,"block_id"))!=access.blockFarm(number(targetSector,"block_id"))) throw bad("El sector no pertenece a la finca");
    if (!request.sensorDeviceId().equals(targetSector.get("sensor_device_id")) || number(sensor,"farm_id")!=access.blockFarm(number(targetSector,"block_id"))) throw bad("El sensor no está asociado al sector y finca");
    requireVersion(current,request.version(),"La verificación del sensor cambió; actualiza la vista");
    int changed=queries.execute("UPDATE irrigation_sensor_check SET sector_id=?,sensor_device_id=?,checked_on=?,calibration_status=?,reference_value=?,observed_value=?,technician=?,notes=?,version=version+1 WHERE id=? AND version=?",
      request.sectorId(),request.sensorDeviceId(),request.checkedOn(),request.calibrationStatus().name(),request.referenceValue(),request.observedValue(),request.technician(),request.notes(),id,request.version());
    if (changed==0) throw conflict("La verificación del sensor cambió; actualiza la vista");
    return row("irrigation_sensor_check",id);
  }
  private void bounds(MoistureUnit unit,BigDecimal lower,BigDecimal upper) {
    if ((lower==null)!=(upper==null) || (lower!=null && (lower.compareTo(upper)>=0 || (unit!=MoistureUnit.KPA && upper.compareTo(BigDecimal.valueOf(100))>0)))) throw bad("Define ambos límites en orden creciente y en la unidad del sector");
  }
  @Transactional public Map<String,Object> createSector(Sector request) {
    long farmId=access.blockFarm(request.blockId()); access.require(farmId,true); bounds(request.unit(),request.lowerBound(),request.upperBound());
    var area=queries.value("SELECT area_ha FROM block WHERE id=?",BigDecimal.class,request.blockId());
    if (area!=null && request.areaHa().compareTo(area)>0) throw bad("El área del sector supera el bloque");
    if (request.sensorDeviceId()!=null) {
      var device=row("sensor_device",request.sensorDeviceId());
      if (number(device,"farm_id")!=farmId || device.get("block_id")==null || number(device,"block_id")!=request.blockId() || !Boolean.TRUE.equals(device.get("active"))) throw bad("El sensor debe estar activo y pertenecer al bloque y finca");
      if (queries.value("SELECT COUNT(*) FROM irrigation_sector WHERE sensor_device_id=?",Integer.class,request.sensorDeviceId())>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"El sensor ya está asociado a otro sector");
    }
    long id=queries.insert("INSERT INTO irrigation_sector(block_id,sensor_device_id,details,created_by) VALUES (?,?,?,?)",request.blockId(),request.sensorDeviceId(),encode(request),access.userId()); return sectorStatus(sector(id,true,false));
  }
  @Transactional public Map<String,Object> thresholds(long id,Thresholds request) {
    var row=sector(id,true,true); var config=decode(row.get("details"));
    if (number(row,"version")!=request.version()) throw new ResponseStatusException(HttpStatus.CONFLICT,"La configuración cambió; actualiza la vista");
    bounds(MoistureUnit.valueOf(config.get("unit").toString()),request.lowerBound(),request.upperBound());
    queries.execute("INSERT INTO irrigation_sector_revision(sector_id,details,reason,created_by) VALUES (?,?,?,?)",id,encode(config),request.technicalBasis(),access.userId());
    config.put("lowerBound",request.lowerBound()); config.put("upperBound",request.upperBound()); config.put("maxAgeHours",request.maxAgeHours()); config.put("technicalBasis",request.technicalBasis());
    queries.execute("UPDATE irrigation_sector SET details=?,version=version+1 WHERE id=?",encode(config),id); return sectorStatus(sector(id,true,false));
  }
  @Transactional public Map<String,Object> measure(Measurement request) {
    var row=sector(request.sectorId(),false,false); var config=decode(row.get("details"));
    if (!request.unit().name().equals(config.get("unit")) || request.depthCm()!=((Number) config.get("depthCm")).intValue()) throw bad("La unidad y profundidad deben coincidir con el sector");
    if (request.unit()!=MoistureUnit.KPA && request.value().compareTo(BigDecimal.valueOf(100))>0) throw bad("El porcentaje debe estar entre 0 y 100");
    long id=queries.insert("INSERT INTO irrigation_measurement(sector_id,recorded_at,details,created_by) VALUES (?,?,?,?)",request.sectorId(),request.recordedAt(),encode(request),access.userId());
    var result=present(row("irrigation_measurement",id)); result.put("source","MANUAL"); return result;
  }
  @Transactional public Map<String,Object> schedule(Plan request) {
    var row=sector(request.sectorId(),true,false); long farmId=access.blockFarm(number(row,"block_id"));
    if (queries.value("SELECT COUNT(*) FROM farm_membership WHERE farm_id=? AND user_id=?",Integer.class,farmId,request.assigneeId())!=1) throw bad("El responsable debe pertenecer a la finca");
    var details=json.convertValue(request,new TypeReference<LinkedHashMap<String,Object>>() {}); details.put("sectorSnapshot",sectorStatus(row));
    long id=queries.insert("INSERT INTO irrigation_plan(sector_id,details,created_by) VALUES (?,?,?)",request.sectorId(),encode(details),access.userId()); return presentPlan(plan(id,true,false));
  }
  @Transactional public Map<String,Object> task(long id) {
    var row=plan(id,true,true);
    if (!"SCHEDULED".equals(row.get("status"))) throw bad("La programación está anulada");
    if (row.get("task_id")==null) {
      var plan=json.convertValue(decode(row.get("details")),Plan.class); var sector=sector(plan.sectorId(),true,false); var config=decode(sector.get("details"));
      var created=tasks.create(new TaskDtos.CreateRequest(access.blockFarm(number(sector,"block_id")),null,number(sector,"block_id"),plan.assigneeId(),"Riego #"+id+" · "+config.get("name"),TaskDtos.Activity.irrigation,plan.scheduledOn(),plan.scheduledTime(),TaskDtos.Priority.Media,
        "Programación #"+id+". Sector: "+config.get("name")+". Duración: "+plan.durationMinutes()+" min. Volumen: "+plan.volumeM3()+" m³. "+plan.instructions()+". Justificación: "+plan.justification()));
      queries.execute("UPDATE irrigation_plan SET task_id=?,version=version+1 WHERE id=?",Long.valueOf(created.id()),id);
    }
    return presentPlan(plan(id,true,false));
  }
  @Transactional public Map<String,Object> cancel(long id,Cancel request) {
    var row=plan(id,true,true);
    if (number(row,"version")!=request.version() || !"SCHEDULED".equals(row.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"La programación cambió");
    if (row.get("task_id")!=null) throw bad("Con una tarea generada, bloquéala y documenta la novedad sin borrar la programación");
    queries.execute("UPDATE irrigation_plan SET status='CANCELED',version=version+1,canceled_by=?,cancel_reason=?,canceled_at=CURRENT_TIMESTAMP WHERE id=?",access.userId(),request.reason(),id); return presentPlan(plan(id,true,false));
  }
  public static BigDecimal duration(Execution request) {
    return BigDecimal.valueOf(Duration.between(request.startedAt(),request.endedAt()).toMillis()).divide(BigDecimal.valueOf(60000),6,RoundingMode.HALF_UP).subtract(request.interruptionMinutes());
  }
  public static BigDecimal volume(Execution request) {
    return (request.volumeMode()==VolumeMode.METER ? request.meterEnd().subtract(request.meterStart()).divide(request.meterUnit()==VolumeUnit.L?BigDecimal.valueOf(1000):BigDecimal.ONE,6,RoundingMode.HALF_UP) : request.flowM3h().multiply(duration(request)).divide(BigDecimal.valueOf(60),6,RoundingMode.HALF_UP));
  }
  @Transactional public Map<String,Object> execute(long id,Execution request) {
    var row=plan(id,false,true); var sector=sector(number(row,"sector_id"),false,true);
    if (!"SCHEDULED".equals(row.get("status")) || row.get("task_id")==null) throw bad("Genera una tarea desde una programación vigente");
    var planned=json.convertValue(decode(row.get("details")),Plan.class);
    var task=queries.row("SELECT assignee_id,status FROM farm_task WHERE id=? FOR UPDATE",row.get("task_id"));
    if (number(task,"assignee_id")!=access.userId()) access.require(access.blockFarm(number(sector,"block_id")),true);
    if (!Set.of("pending","progress").contains(task.get("status"))) throw bad("La tarea debe estar pendiente o en progreso");
    if (!request.endedAt().isAfter(request.startedAt()) || Duration.between(request.startedAt(),request.endedAt()).compareTo(Duration.ofDays(30))>0 || duration(request).signum()<=0) throw bad("Revisa inicio, fin e interrupciones; cada ejecución admite un máximo de 30 días");
    if (request.volumeMode()==VolumeMode.METER) {
      if (request.meterStart()==null || request.meterEnd()==null || request.meterUnit()==null || request.flowM3h()!=null || request.meterEnd().compareTo(request.meterStart())<0) throw bad("El contador requiere unidad y lecturas crecientes, sin caudal estimado");
    } else if (request.flowM3h()==null || request.meterStart()!=null || request.meterEnd()!=null || request.meterUnit()!=null) throw bad("La estimación requiere caudal y no debe incluir lecturas de contador");
    BigDecimal volume=volume(request); if (volume.compareTo(BigDecimal.valueOf(1000000000))>0) throw bad("Volumen fuera de rango");
    if (queries.value("SELECT COUNT(*) FROM irrigation_execution e JOIN irrigation_plan p ON p.id=e.plan_id WHERE p.sector_id=? AND e.started_at<? AND e.ended_at>?",Integer.class,planned.sectorId(),request.endedAt(),request.startedAt())>0) throw bad("Ya existe una ejecución en ese intervalo para el sector");
    var summary=presentPlan(row);
    if ((decimal(summary.get("actualVolumeM3")).add(volume).compareTo(planned.volumeM3())>0 || decimal(summary.get("actualDurationMinutes")).add(duration(request)).compareTo(planned.durationMinutes())>0) && (request.varianceReason()==null || request.varianceReason().isBlank())) throw bad("Documenta la razón de superar el volumen o duración programados");
    long eventId=queries.insert("INSERT INTO field_event(event_type,occurred_at,created_by_user_id,block_id,notes) VALUES ('IRRIGATION_EVENT',?,?,?,?)",request.startedAt(),access.userId(),number(sector,"block_id"),"Riego #"+id+" · "+volume+" m³ · "+request.volumeMode()+" · "+Objects.toString(request.notes(),""));
    long executionId=queries.insert("INSERT INTO irrigation_execution(plan_id,event_id,started_at,ended_at,volume_m3,duration_minutes,volume_mode,details,created_by) VALUES (?,?,?,?,?,?,?,?,?)",id,eventId,request.startedAt(),request.endedAt(),volume,duration(request),request.volumeMode().name(),encode(request),access.userId());
    queries.execute("UPDATE farm_task SET status='progress',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",row.get("task_id")); return presentExecution(row("irrigation_execution",executionId));
  }
}
