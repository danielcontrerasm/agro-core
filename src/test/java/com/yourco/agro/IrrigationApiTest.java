package com.yourco.agro;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.irrigation.*;
import com.yourco.agro.tasks.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.jdbc.datasource.embedded.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import javax.sql.DataSource;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(IrrigationController.class)
@Import({SecurityConfig.class,FarmAccess.class,TaskService.class,IrrigationService.class,IrrigationApiTest.Database.class})
class IrrigationApiTest {
  @TestConfiguration @EnableTransactionManagement static class Database {
    @Bean DataSource dataSource() { return new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2)
      .addScript("fertilization-schema.sql").addScript("db/migration/V2__users_and_memberships.sql")
      .addScript("db/migration/V3__farm_tasks.sql").addScript("irrigation-test-options.sql").addScript("db/migration/V5__telemetry_alerts.sql")
      .addScript("db/migration/V11__irrigation_workflow.sql").addScript("db/migration/V13__irrigation_water_and_maintenance.sql").addScript("db/migration/V16__irrigation_management_updates.sql").build(); }
    @Bean JdbcTemplate jdbcTemplate(DataSource dataSource) { return new JdbcTemplate(dataSource); }
    @Bean JdbcTransactionManager transactionManager(DataSource dataSource) { return new JdbcTransactionManager(dataSource); }
  }
  @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
  private UsernamePasswordAuthenticationToken login(long id) { return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User(id,"Operator","operator@test.local"),null,List.of()); }
  @BeforeEach void seed() {
    for (String table : List.of("irrigation_sensor_check","irrigation_maintenance","irrigation_water_balance","irrigation_water_quality","irrigation_infrastructure","irrigation_water_source","irrigation_execution","irrigation_plan","irrigation_measurement","irrigation_sector_revision","irrigation_sector","sensor_reading","sensor_device","farm_task","field_event","farm_membership","app_user","block","field","farm")) jdbc.update("DELETE FROM "+table);
    jdbc.update("INSERT INTO farm VALUES(10,'North'),(20,'South')"); jdbc.update("INSERT INTO field VALUES(11,10),(21,20)");
    jdbc.update("INSERT INTO block VALUES(12,11,28),(15,11,18),(22,21,10)");
    jdbc.update("INSERT INTO app_user(id,name,email,password_hash) VALUES(1,'Worker','worker@test.local','hash'),(2,'Manager','manager@test.local','hash'),(3,'Other','other@test.local','hash')");
    jdbc.update("INSERT INTO farm_membership VALUES(10,1,'WORKER'),(10,2,'ADMIN'),(10,3,'WORKER')");
    jdbc.update("INSERT INTO sensor_device(id,farm_id,block_id,name,device_key) VALUES(31,10,12,'Moisture','sensor-1'),(32,20,22,'Foreign','sensor-2')");
  }
  private ResultActions postAs(String path,Object payload,long user) throws Exception { return mvc.perform(post("/api/v1/irrigation/"+path).with(authentication(login(user))).with(csrf()).contentType("application/json").content(json.writeValueAsString(payload))); }
  private ResultActions patchAs(String path,Object payload,long user) throws Exception { return mvc.perform(patch("/api/v1/irrigation/"+path).with(authentication(login(user))).with(csrf()).contentType("application/json").content(json.writeValueAsString(payload))); }
  private JsonNode created(String path,Object payload,long user) throws Exception { return json.readTree(postAs(path,payload,user).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()); }
  private Map<String,Object> sector() { return new HashMap<>(Map.of("blockId",12,"name","Sector A","areaHa",10,"system","Goteo","waterSource","Reservorio","unit","VWC_PERCENT","depthCm",20,"maxAgeHours",24,"technicalBasis","Configuración técnica")); }
  private Map<String,Object> measurement(long sectorId,double value) { return new HashMap<>(Map.of("sectorId",sectorId,"recordedAt",Instant.now().minusSeconds(60).toString(),"value",value,"unit","VWC_PERCENT","depthCm",20,"instrument","Equipo manual","rainMm",0,"drainage","Sin novedades")); }
  private Map<String,Object> plan(long sectorId) { return Map.of("sectorId",sectorId,"scheduledOn","2026-01-10","scheduledTime","08:00","durationMinutes",60,"volumeM3",12,"assigneeId",1,"justification","Revisado por responsable","instructions","Registrar consumo"); }
  private long scheduled(boolean task) throws Exception {
    long sectorId=created("sectors",sector(),2).get("id").asLong(); long id=created("plans",plan(sectorId),2).get("id").asLong();
    if (task) postAs("plans/"+id+"/task",Map.of(),2).andExpect(status().isOk()); return id;
  }
  private Map<String,Object> execution(String start,String end) { return new HashMap<>(Map.of("startedAt",start,"endedAt",end,"interruptionMinutes",0,"volumeMode","METER","meterUnit","L","meterStart",1000,"meterEnd",7000)); }
  @Test void sectorsMeasurementsAndThresholdsRespectPermissionsAndUnits() throws Exception {
    postAs("sectors",sector(),1).andExpect(status().isForbidden());
    var foreign=sector(); foreign.put("blockId",22); postAs("sectors",foreign,2).andExpect(status().isForbidden());
    var invalid=sector(); invalid.put("sensorDeviceId",32); postAs("sectors",invalid,2).andExpect(status().isBadRequest());
    invalid=sector(); invalid.put("lowerBound",40); invalid.put("upperBound",20); postAs("sectors",invalid,2).andExpect(status().isBadRequest());
    long id=created("sectors",sector(),2).get("id").asLong();
    var reading=measurement(id,27); reading.put("unit","KPA"); postAs("measurements",reading,1).andExpect(status().isBadRequest());
    postAs("measurements",measurement(id,101),1).andExpect(status().isBadRequest());
    created("measurements",measurement(id,27),1);
    mvc.perform(get("/api/v1/irrigation?farmId=10").with(authentication(login(1)))).andExpect(status().isOk()).andExpect(jsonPath("$.sectors[0].condition").value("UNCONFIGURED"));
    var config=Map.of("version",0,"lowerBound",25,"upperBound",35,"maxAgeHours",24,"technicalBasis","Calibración verificada");
    postAs("sectors/"+id+"/thresholds",config,1).andExpect(status().isForbidden());
    postAs("sectors/"+id+"/thresholds",config,2).andExpect(status().isOk()).andExpect(jsonPath("$.condition").value("IN_RANGE"));
    postAs("sectors/"+id+"/thresholds",config,2).andExpect(status().isConflict());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM irrigation_sector_revision",Integer.class)).isEqualTo(1);
    mvc.perform(get("/api/v1/irrigation?farmId=20").with(authentication(login(1)))).andExpect(status().isForbidden());
  }
  @Test void sensorReadingsUseDeclaredProfileAndStaleReadingsAreNotCurrent() throws Exception {
    var config=sector(); config.put("sensorDeviceId",31); config.put("lowerBound",25); config.put("upperBound",35);
    long id=created("sectors",config,2).get("id").asLong();
    jdbc.update("UPDATE irrigation_sector SET created_at=? WHERE id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(400000)),id);
    jdbc.update("INSERT INTO sensor_reading(device_id,recorded_at,soil_moisture) VALUES(31,?,18)",java.sql.Timestamp.from(Instant.now().minusSeconds(172800)));
    mvc.perform(get("/api/v1/irrigation?farmId=10").with(authentication(login(1)))).andExpect(status().isOk()).andExpect(jsonPath("$.sectors[0].condition").value("STALE")).andExpect(jsonPath("$.sectors[0].latest.source").value("SENSOR"));
    created("measurements",measurement(id,20),1);
    mvc.perform(get("/api/v1/irrigation?farmId=10").with(authentication(login(1)))).andExpect(status().isOk()).andExpect(jsonPath("$.sectors[0].condition").value("BELOW_RANGE")).andExpect(jsonPath("$.sectors[0].latest.source").value("MANUAL"));
  }
  @Test void tasksAreIdempotentAndExecutionsNormalizeLitersAndPreventOverlap() throws Exception {
    long id=scheduled(true); postAs("plans/"+id+"/task",Map.of(),2).andExpect(status().isOk());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM farm_task",Integer.class)).isEqualTo(1);
    var first=execution("2026-01-10T13:00:00Z","2026-01-10T13:30:00Z");
    postAs("plans/"+id+"/executions",first,3).andExpect(status().isForbidden());
    created("plans/"+id+"/executions",first,1);
    postAs("plans/"+id+"/executions",first,1).andExpect(status().isBadRequest());
    var second=execution("2026-01-10T13:30:00Z","2026-01-10T14:00:00Z"); created("plans/"+id+"/executions",second,1);
    mvc.perform(get("/api/v1/irrigation?farmId=10").with(authentication(login(1)))).andExpect(status().isOk()).andExpect(jsonPath("$.plans[0].actualVolumeM3").value(12)).andExpect(jsonPath("$.plans[0].actualDurationMinutes").value(60));
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM field_event WHERE event_type='IRRIGATION_EVENT'",Integer.class)).isEqualTo(2);
    assertThat(jdbc.queryForObject("SELECT status FROM farm_task",String.class)).isEqualTo("progress");
  }
  @Test void estimatedConsumptionSubtractsInterruptionsAndOverrunsRequireExplanation() throws Exception {
    long id=scheduled(true);
    var request=new HashMap<String,Object>(Map.of("startedAt","2026-01-10T13:00:00Z","endedAt","2026-01-10T15:00:00Z","interruptionMinutes",30,"volumeMode","FLOW","flowM3h",12));
    postAs("plans/"+id+"/executions",request,1).andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("Documenta la razón de superar el volumen o duración programados"));
    request.put("varianceReason","Revisión operativa del exceso");
    var result=created("plans/"+id+"/executions",request,1);
    assertThat(result.get("volumeM3").asDouble()).isEqualTo(18); assertThat(result.get("durationMinutes").asDouble()).isEqualTo(90);
    jdbc.update("UPDATE farm_task SET status='review'");
    postAs("plans/"+id+"/executions",execution("2026-01-11T13:00:00Z","2026-01-11T13:30:00Z"),1).andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM irrigation_execution",Integer.class)).isEqualTo(1);
  }
  @Test void cancellationAndInvalidCounterCannotCreateEvents() throws Exception {
    long id=scheduled(false);
    postAs("plans/"+id+"/executions",execution("2026-01-10T13:00:00Z","2026-01-10T14:00:00Z"),1).andExpect(status().isBadRequest());
    postAs("plans/"+id+"/cancel",Map.of("version",0,"reason","Lluvia registrada"),2).andExpect(status().isOk());
    postAs("plans/"+id+"/task",Map.of(),2).andExpect(status().isBadRequest());
    id=scheduled(true); var request=execution("2026-01-10T13:00:00Z","2026-01-10T14:00:00Z"); request.put("meterEnd",100);
    postAs("plans/"+id+"/executions",request,1).andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM field_event",Integer.class)).isEqualTo(0);
  }
  @Test void managementRecordsCanBeUpdatedWithVersionAndFarmIsolation() throws Exception {
    var source=created("water-sources",Map.of("farmId",10,"name","Reservorio","sourceType","RESERVOIR","capacityM3",1000,"notes","Inicial"),2);
    long sourceId=jdbc.queryForObject("SELECT MAX(id) FROM irrigation_water_source",Long.class);
    patchAs("water-sources/"+sourceId,Map.of("name","Reservorio norte","sourceType","RESERVOIR","capacityM3",1200,"active",false,"version",0),1).andExpect(status().isForbidden());
    patchAs("water-sources/"+sourceId,Map.of("name","Reservorio norte","sourceType","RESERVOIR","capacityM3",1200,"active",false,"version",0),2).andExpect(status().isOk());
    patchAs("water-sources/"+sourceId,Map.of("name","Reservorio repetido","sourceType","RESERVOIR","capacityM3",1200,"active",false,"version",0),2).andExpect(status().isConflict());
    created("water-sources/"+sourceId+"/quality",Map.of("sampledOn","2026-01-10","ph",6.5,"conductivityDsM",0.4,"salinityPpm",100,"suspendedSolidsMgL",20,"laboratoryReference","LAB-1"),2);
    long qualityId=jdbc.queryForObject("SELECT MAX(id) FROM irrigation_water_quality",Long.class);
    patchAs("water-quality/"+qualityId,Map.of("sourceId",sourceId,"sampledOn","2026-01-11","ph",6.8,"conductivityDsM",0.5,"salinityPpm",110,"suspendedSolidsMgL",18,"laboratoryReference","LAB-2","version",0),2).andExpect(status().isOk());
    created("infrastructure",Map.of("farmId",10,"assetType","PUMP","code","P-01","status","ACTIVE","sourceId",sourceId),2);
    long assetId=jdbc.queryForObject("SELECT MAX(id) FROM irrigation_infrastructure",Long.class);
    patchAs("infrastructure/"+assetId,Map.of("assetType","PUMP","code","P-01","status","MAINTENANCE","sourceId",sourceId,"version",0),2).andExpect(status().isOk());
    long sectorId=created("sectors",new HashMap<>(Map.of("blockId",12,"name","Sector A","areaHa",10,"system","Goteo","waterSource","Reservorio","unit","VWC_PERCENT","depthCm",20,"maxAgeHours",24,"technicalBasis","Configuración técnica")),2).get("id").asLong();
    created("water-balances",Map.of("sectorId",sectorId,"balanceDate","2026-01-10","rainfallMm",4,"requiredVolumeM3",20,"appliedVolumeM3",12),2);
    long balanceId=jdbc.queryForObject("SELECT MAX(id) FROM irrigation_water_balance",Long.class);
    patchAs("water-balances/"+balanceId,Map.of("sectorId",sectorId,"balanceDate","2026-01-10","rainfallMm",5,"requiredVolumeM3",20,"appliedVolumeM3",15,"version",0),2).andExpect(status().isOk());
    created("maintenance",Map.of("infrastructureId",assetId,"maintenanceType","PUMP_CHECK","scheduledOn","2026-01-10","status","PLANNED","notes","Inicial"),2);
    long maintenanceId=jdbc.queryForObject("SELECT MAX(id) FROM irrigation_maintenance",Long.class);
    patchAs("maintenance/"+maintenanceId,Map.of("infrastructureId",assetId,"maintenanceType","PUMP_CHECK","scheduledOn","2026-01-10","status","COMPLETED","completedOn","2026-01-11","notes","Revisado","version",0),2).andExpect(status().isOk());
    var sensorSector=new HashMap<>(sector()); sensorSector.put("name","Sensor sector"); sensorSector.put("sensorDeviceId",31);
    long sensorSectorId=created("sectors",sensorSector,2).get("id").asLong();
    created("sensor-checks",Map.of("sectorId",sensorSectorId,"sensorDeviceId",31,"checkedOn","2026-01-10","calibrationStatus","DUE","referenceValue",30,"observedValue",28,"technician","Ana"),2);
    long checkId=jdbc.queryForObject("SELECT MAX(id) FROM irrigation_sensor_check",Long.class);
    patchAs("sensor-checks/"+checkId,Map.of("sectorId",sensorSectorId,"sensorDeviceId",31,"checkedOn","2026-01-11","calibrationStatus","VALID","referenceValue",30,"observedValue",30,"technician","Ana","version",0),2).andExpect(status().isOk());
    assertThat(jdbc.queryForObject("SELECT active FROM irrigation_water_source WHERE id=?",Boolean.class,sourceId)).isFalse();
    assertThat(jdbc.queryForObject("SELECT status FROM irrigation_maintenance WHERE id=?",String.class,maintenanceId)).isEqualTo("COMPLETED");
    assertThat(jdbc.queryForObject("SELECT version FROM irrigation_sensor_check WHERE id=?",Long.class,checkId)).isEqualTo(1L);
  }
}
