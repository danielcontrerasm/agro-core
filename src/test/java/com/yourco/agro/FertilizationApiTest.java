package com.yourco.agro;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.fertilization.*;
import com.yourco.agro.tasks.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.jdbc.datasource.embedded.*;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import javax.sql.DataSource;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FertilizationController.class)
@Import({SecurityConfig.class,FarmAccess.class,TaskService.class,FertilizationService.class,FertilizationApiTest.Database.class})
class FertilizationApiTest {
  @TestConfiguration @EnableTransactionManagement
  static class Database {
    @Bean DataSource dataSource() {
      return new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2)
        .addScript("fertilization-schema.sql").addScript("db/migration/V2__users_and_memberships.sql")
        .addScript("db/migration/V3__farm_tasks.sql")
        .addScript("db/migration/V6__phytosanitary_inspections.sql")
        .addScript("db/migration/V7__inspection_treatments_and_evidence.sql")
        .addScript("db/migration/V9__fertilization_workflow.sql")
        .addScript("db/migration/V10__fertilization_cancellation_audit.sql").build();
    }
    @Bean JdbcTemplate jdbcTemplate(DataSource dataSource) { return new JdbcTemplate(dataSource); }
    @Bean JdbcTransactionManager transactionManager(DataSource dataSource) { return new JdbcTransactionManager(dataSource); }
  }
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;
  @Autowired FertilizationService service;
  private UsernamePasswordAuthenticationToken login(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User(id,"Operator","user@example.com"),null,List.of());
  }
  @BeforeEach void seed() {
    for (String table : List.of("fertilization_followup","fertilization_application","fertilization_plan","soil_analysis","farm_task","field_event","farm_membership","app_user","block","field","farm")) jdbc.update("DELETE FROM "+table);
    jdbc.update("INSERT INTO farm VALUES (10,'North'),(20,'South')");
    jdbc.update("INSERT INTO field VALUES (11,10),(21,20)");
    jdbc.update("INSERT INTO block VALUES (12,11,28),(15,11,18),(22,21,10)");
    jdbc.update("INSERT INTO app_user(id,name,email,password_hash) VALUES (1,'Worker','worker@test.local','hash'),(2,'Manager','manager@test.local','hash'),(3,'Other','other@test.local','hash')");
    jdbc.update("INSERT INTO farm_membership VALUES (10,1,'WORKER'),(10,2,'ADMIN'),(10,3,'WORKER')");
  }
  private Map<String,Object> analysis() {
    return new HashMap<>(Map.of("blockId",12,"sampleType","SOIL","sampledOn","2026-01-10","laboratory","Lab","reference","S-1","depthCm",20,"results",List.of(Map.of("nutrient","K","value",0.35,"unit","CMOL_KG","method","Acetato"),Map.of("nutrient","PH","value",5.8,"unit","PH","method","Agua"))));
  }
  private ResultActions postAs(String path,Object body,long user) throws Exception {
    return mvc.perform(post("/api/v1/fertilization/"+path).with(authentication(login(user))).with(csrf()).contentType("application/json").content(json.writeValueAsString(body)));
  }
  private JsonNode created(String path,Object body,long user) throws Exception {
    return json.readTree(postAs(path,body,user).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
  }
  private Map<String,Object> plan(long analysisId) {
    var request = new HashMap<String,Object>();
    request.putAll(Map.of("blockId",12,"analysisId",analysisId,"growthStage","Vegetativo","diagnosis","Interpretación técnica documentada","objective","Seguimiento nutricional","product","Producto técnico","composition","K 20%","dose",50,"doseUnit","G_PLANT","coverage",1000));
    request.putAll(Map.of("method","Aplicación según revisión técnica","scheduledOn","2026-01-11","scheduledTime","08:00","assigneeId",1,"followUpOn","2026-01-20")); return request;
  }
  private long approved(boolean withTask) throws Exception {
    long sampleId=created("analyses",analysis(),1).get("id").asLong();
    long id=created("plans",plan(sampleId),2).get("id").asLong();
    postAs("plans/"+id+"/approve",Map.of("version",0,"reason","Revisión técnica realizada"),2).andExpect(status().isOk());
    if (withTask) postAs("plans/"+id+"/task",Map.of(),2).andExpect(status().isOk());
    return id;
  }
  private Map<String,Object> application(double quantity) {
    return Map.of("occurredAt","2026-01-12T13:00:00Z","quantity",quantity,"coverage",1000,"method","Manual","lot","L-123","notes","Parcial documentada");
  }
  @Test void validatesUnitsCoordinatesDatesAndFarmIsolation() throws Exception {
    var request=analysis(); request.put("blockId",22); postAs("analyses",request,1).andExpect(status().isForbidden());
    request=analysis(); request.put("latitude",4); postAs("analyses",request,1).andExpect(status().isBadRequest());
    request=analysis(); request.put("results",List.of(Map.of("nutrient","PH","value",7,"unit","MG_KG","method","Agua"))); postAs("analyses",request,1).andExpect(status().isBadRequest());
    request.put("results",List.of(Map.of("nutrient","N","value",101,"unit","PERCENT","method","Total"))); postAs("analyses",request,1).andExpect(status().isBadRequest());
    request=analysis(); request.put("sampledOn","2099-01-01"); postAs("analyses",request,1).andExpect(status().isBadRequest());
    long sampleId=created("analyses",analysis(),1).get("id").asLong();
    postAs("plans",plan(sampleId),1).andExpect(status().isForbidden());
    var wrong=plan(sampleId); wrong.put("blockId",15); postAs("plans",wrong,2).andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/fertilization?farmId=20").with(authentication(login(2)))).andExpect(status().isForbidden());
  }
  @Test void approvalIsVersionedAndTaskGenerationIsIdempotent() throws Exception {
    long sampleId=created("analyses",analysis(),1).get("id").asLong();
    long id=created("plans",plan(sampleId),2).get("id").asLong();
    postAs("plans/"+id+"/task",Map.of(),2).andExpect(status().isBadRequest());
    postAs("plans/"+id+"/applications",application(10),1).andExpect(status().isBadRequest());
    postAs("plans/"+id+"/approve",Map.of("version",0,"reason","OK"),1).andExpect(status().isForbidden());
    postAs("plans/"+id+"/approve",Map.of("version",1,"reason","OK"),2).andExpect(status().isConflict());
    postAs("plans/"+id+"/approve",Map.of("version",0,"reason","OK"),2).andExpect(status().isOk()).andExpect(jsonPath("$.totalQuantity").value(50));
    postAs("plans/"+id+"/approve",Map.of("version",0,"reason","OK"),2).andExpect(status().isConflict());
    postAs("plans/"+id+"/task",Map.of(),2).andExpect(status().isOk());
    postAs("plans/"+id+"/task",Map.of(),2).andExpect(status().isOk());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM farm_task",Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT instructions FROM farm_task",String.class)).contains("50.000000 kg");
  }
  @Test void partialApplicationsAreAtomicAuthorizedAndLinkedToEvents() throws Exception {
    long id=approved(true);
    postAs("plans/"+id+"/applications",application(10),3).andExpect(status().isForbidden());
    postAs("plans/"+id+"/applications",application(-1),1).andExpect(status().isBadRequest());
    created("plans/"+id+"/applications",application(20),1);
    postAs("plans/"+id+"/applications",application(31),1).andExpect(status().isBadRequest());
    created("plans/"+id+"/applications",application(30),1);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM field_event WHERE event_type='FERTILIZER_APPLICATION'",Integer.class)).isEqualTo(2);
    assertThat(jdbc.queryForObject("SELECT status FROM farm_task",String.class)).isEqualTo("progress");
    mvc.perform(get("/api/v1/fertilization?farmId=10").with(authentication(login(1)))).andExpect(status().isOk()).andExpect(jsonPath("$.plans[0].appliedQuantity").value(50)).andExpect(jsonPath("$.applications[0].eventId").isNumber());
    jdbc.update("UPDATE farm_task SET status='blocked'");
    postAs("plans/"+id+"/applications",application(1),1).andExpect(status().isBadRequest());
  }
  @Test void reportsAreAuthenticatedAndFollowupsValidateBlockAndTime() throws Exception {
    long id=approved(true);
    long sampleId=jdbc.queryForObject("SELECT analysis_id FROM fertilization_plan WHERE id=?",Long.class,id);
    var file=new MockMultipartFile("file","lab.pdf","application/pdf","%PDF-1.4\nExample".getBytes());
    mvc.perform(multipart("/api/v1/fertilization/analyses/"+sampleId+"/report").file(file).with(authentication(login(1))).with(csrf())).andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/fertilization/analyses/"+sampleId+"/report")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/fertilization/analyses/"+sampleId+"/report").with(authentication(login(1)))).andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options","nosniff")).andExpect(content().bytes(file.getBytes()));
    postAs("plans/"+id+"/followups",Map.of("analysisId",sampleId,"observations","Anterior"),2).andExpect(status().isBadRequest());
    var next=analysis(); next.put("sampledOn","2026-01-21"); long nextId=created("analyses",next,1).get("id").asLong();
    postAs("plans/"+id+"/followups",Map.of("analysisId",nextId,"observations","Comparación documentada"),2).andExpect(status().isNoContent());
    postAs("plans/"+id+"/followups",Map.of("observations","No autorizado"),1).andExpect(status().isForbidden());
    assertThat(service.latestSoil(12).get("id")).isEqualTo(nextId);
    next.put("sampleType","FOLIAR"); created("analyses",next,1);
    assertThat(service.latestSoil(12).get("id")).isEqualTo(nextId);
    assertThat(service.latestSoil(15)).isNull();
  }
  @Test void unitConversionsAndCancellationPreserveApprovalAudit() throws Exception {
    long sampleId=created("analyses",analysis(),1).get("id").asLong();
    for (var unit : List.of("KG_HA","L_HA","G_PLANT","ML_PLANT")) {
      var request=plan(sampleId); request.put("doseUnit",unit); request.put("coverage",2);
      var result=created("plans",request,2);
      assertThat(result.get("totalQuantity").asDouble()).isEqualTo(unit.endsWith("HA") ? 100.0 : 0.1);
    }
    long id=approved(false);
    postAs("plans/"+id+"/cancel",Map.of("version",1,"reason","Revisión del plan"),2).andExpect(status().isOk()).andExpect(jsonPath("$.approvedBy").value(2)).andExpect(jsonPath("$.canceledBy").value(2));
    postAs("plans/"+id+"/task",Map.of(),2).andExpect(status().isBadRequest());
  }
}
