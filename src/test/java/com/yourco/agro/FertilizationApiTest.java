package com.yourco.agro;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.fertilization.*;
import com.yourco.agro.finances.FinanceService;
import com.yourco.agro.inventory.InventoryService;
import com.yourco.agro.persistence.JpaSql;
import com.yourco.agro.tasks.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FertilizationController.class)
@Import({SecurityConfig.class,FarmAccess.class,TaskService.class,FertilizationService.class,InventoryService.class,FinanceService.class,FertilizationApiTest.Database.class})
class FertilizationApiTest {
  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class Database {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database(
        "fertilization-schema.sql",
        "db/migration/V2__users_and_memberships.sql",
        "db/migration/V3__farm_tasks.sql",
        "db/migration/V6__phytosanitary_inspections.sql",
        "db/migration/V7__inspection_treatments_and_evidence.sql",
        "db/migration/V9__fertilization_workflow.sql",
        "db/migration/V10__fertilization_cancellation_audit.sql",
        "db/migration/V19__nutrient_profiles_and_reviews.sql",
        "db/migration/V21__fertilizer_products_and_recurring_plans.sql",
        "finance-schema.sql",
        "db/migration/V25__inventory.sql",
        "db/migration/V26__farm_finances.sql",
        "db/migration/V30__inventory_application_costs.sql",
        "db/migration/V31__fertilization_application_inventory.sql",
        "db/migration/V36_1__inventory_product_names.sql",
        "db/migration/V36_2__fertilization_inventory_product.sql"
      );
    }
  }
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;
  @Autowired FertilizationService service;
  private long stockLot;
  private UsernamePasswordAuthenticationToken login(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User(id,"Operator","user@example.com"),null,List.of());
  }
  @BeforeEach void seed() {
    for (String table : List.of("nutrient_analysis_review","nutrient_reference_range","nutrient_reference_profile","fertilization_plan_task","fertilization_followup","fertilization_application","fertilization_plan","farm_financial_entry","inventory_movement","inventory_lot","inventory_product","fertilizer_product","soil_analysis","farm_task","field_event","farm_membership","app_user","block","field","farm")) queries.execute("DELETE FROM "+table);
    queries.execute("INSERT INTO farm VALUES (10,'North'),(20,'South')");
    queries.execute("INSERT INTO field(id,farm_id,name) VALUES (11,10,'Norte'),(21,20,'Sur')");
    queries.execute("INSERT INTO block(id,field_id,area_ha,crop,variety,code) VALUES (12,11,28,'banana','Valery','A'),(15,11,18,'banana','Valery','B'),(22,21,10,'banana','Valery','C')");
    queries.execute("INSERT INTO app_user(id,name,email,password_hash) VALUES (1,'Worker','worker@test.local','hash'),(2,'Manager','manager@test.local','hash'),(3,'Other','other@test.local','hash')");
    queries.execute("INSERT INTO farm_membership VALUES (10,1,'WORKER'),(10,2,'ADMIN'),(10,3,'WORKER')");
    stockLot = stockedLot(10, "FERT", "producto técnico", "kilogramos", "L-123", 60, new BigDecimal("12.50"), null);
  }
  private long stockedLot(long farmId, String sku, String product, String unit, String lot, int quantity, BigDecimal cost, LocalDate expiresOn) {
    long productId = queries.insert("INSERT INTO inventory_product(farm_id,code,name,category,unit,minimum) VALUES (?,?,?,'Fertilizantes',?,0)", farmId, sku, product, unit);
    return stockedLot(farmId, productId, lot, quantity, cost, expiresOn);
  }
  private long stockedLot(long farmId, long productId, String lot, int quantity, BigDecimal cost, LocalDate expiresOn) {
    return queries.insert("INSERT INTO inventory_lot(farm_id,product_id,code,balance,unit_cost_cop,expires_on) VALUES (?,?,?,?,?,?)", farmId, productId, lot, quantity, cost, expiresOn);
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
    return new HashMap<>(Map.of("occurredAt","2026-01-12T13:00:00Z","quantity",quantity,"coverage",1000,"method","Manual",
      "inventoryLotId",stockLot,"operationId",UUID.randomUUID(),"notes","Parcial documentada"));
  }
  @Test void reassignsOnlyPendingTasksOfTheApprovedPlan() throws Exception {
    long planId = approved(true);
    long taskId = queries.value("SELECT task_id FROM fertilization_plan WHERE id=?", Long.class, planId);
    String url = "/api/v1/fertilization/plans/" + planId + "/tasks/" + taskId + "/assignment";
    String reassignment = json.writeValueAsString(Map.of("assigneeId", 3, "version", 0));
    mvc.perform(patch(url).with(authentication(login(1))).with(csrf())
      .contentType("application/json").content(reassignment)).andExpect(status().isForbidden());
    mvc.perform(patch(url).with(authentication(login(2))).with(csrf())
      .contentType("application/json").content(json.writeValueAsString(Map.of("assigneeId", 999, "version", 0))))
      .andExpect(status().isBadRequest());
    mvc.perform(patch(url).with(authentication(login(2))).with(csrf())
      .contentType("application/json").content(reassignment)).andExpect(status().isNoContent());
    assertThat(queries.value("SELECT assignee_id FROM farm_task WHERE id=?", Long.class, taskId)).isEqualTo(3L);
    mvc.perform(patch(url).with(authentication(login(2))).with(csrf())
      .contentType("application/json").content(reassignment)).andExpect(status().isConflict());
    queries.execute("UPDATE farm_task SET status='progress' WHERE id=?", taskId);
    mvc.perform(patch(url).with(authentication(login(2))).with(csrf())
      .contentType("application/json").content(json.writeValueAsString(Map.of("assigneeId", 1, "version", 1))))
      .andExpect(status().isConflict());
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
  @Test void agronomistCanCreateProfileAndReviewAnalysis() throws Exception {
    var profile = Map.of("farmId",10,"name","Banano suelo","crop","banana","variety","Valery","sampleType","SOIL","version","2026.1","source","Laboratorio local",
      "ranges",List.of(Map.of("nutrient","K","unit","CMOL_KG","lowerBound",0.3,"upperBound",0.6),Map.of("nutrient","PH","unit","PH","lowerBound",5.5,"upperBound",6.5)));
    mvc.perform(post("/api/v1/fertilization/profiles").with(authentication(login(2))).with(csrf()).contentType("application/json").content(json.writeValueAsString(profile)))
      .andExpect(status().isCreated()).andExpect(jsonPath("$.ranges.length()").value(2));
    long sampleId=created("analyses",analysis(),1).get("id").asLong();
    mvc.perform(get("/api/v1/fertilization?farmId=10").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.analyses[0].interpretations[0].status").value("ADEQUATE"));
    postAs("analyses/"+sampleId+"/review",Map.of("decision","CONFIRMED","notes","Revisado con el informe de laboratorio"),2)
      .andExpect(status().isOk()).andExpect(jsonPath("$.decision").value("CONFIRMED"));
    postAs("analyses/"+sampleId+"/review",Map.of("decision","CONFIRMED","notes","No autorizado"),1).andExpect(status().isForbidden());
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
    assertThat(queries.value("SELECT COUNT(*) FROM farm_task",Integer.class)).isEqualTo(1);
    assertThat(queries.value("SELECT instructions FROM farm_task",String.class)).contains("50.000000 kg");
  }
  @Test void partialApplicationsAreAtomicAuthorizedAndLinkedToEvents() throws Exception {
    long id=approved(true);
    postAs("plans/"+id+"/applications",application(10),3).andExpect(status().isForbidden());
    postAs("plans/"+id+"/applications",application(-1),1).andExpect(status().isBadRequest());
    var request = application(20);
    var first = created("plans/"+id+"/applications",request,1);
    assertThat(first.get("lot").asText()).isEqualTo("L-123");
    assertThat(first.get("inventoryLotId").asLong()).isEqualTo(stockLot);
    assertThat(first.has("costCop")).isFalse();
    assertThat(first.has("financialEntryId")).isFalse();
    assertThat(created("plans/"+id+"/applications",request,1).get("id")).isEqualTo(first.get("id"));
    var mismatched = new HashMap<>(request); mismatched.put("quantity",21);
    postAs("plans/"+id+"/applications",mismatched,1).andExpect(status().isConflict());
    postAs("plans/"+id+"/applications",application(31),1).andExpect(status().isBadRequest());
    created("plans/"+id+"/applications",application(30),1);
    assertThat(queries.value("SELECT COUNT(*) FROM field_event WHERE event_type='FERTILIZER_APPLICATION'",Integer.class)).isEqualTo(2);
    assertThat(queries.value("SELECT COUNT(*) FROM inventory_movement WHERE lot_id=? AND direction='OUT'",Integer.class,stockLot)).isEqualTo(2);
    assertThat(queries.value("SELECT balance FROM inventory_lot WHERE id=?",BigDecimal.class,stockLot)).isEqualByComparingTo("10");
    assertThat(queries.value("SELECT amount FROM farm_financial_entry WHERE source_type='FERTILIZATION_APPLICATION' AND source_id=?",BigDecimal.class,first.get("id").asLong())).isEqualByComparingTo("250");
    assertThat(queries.value("SELECT status FROM farm_task",String.class)).isEqualTo("progress");
    mvc.perform(get("/api/v1/fertilization?farmId=10").with(authentication(login(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.plans[0].appliedQuantity").value(50)).andExpect(jsonPath("$.applications[0].eventId").isNumber())
      .andExpect(jsonPath("$.applications[0].costCop").doesNotExist());
    mvc.perform(get("/api/v1/fertilization?farmId=10").with(authentication(login(2)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.applications[0].financialEntryId").isNumber()).andExpect(jsonPath("$.applications[0].costCop").value(375));
    queries.execute("UPDATE farm_task SET status='blocked'");
    assertThat(created("plans/"+id+"/applications",request,1).get("id")).isEqualTo(first.get("id"));
    postAs("plans/"+id+"/applications",application(1),1).andExpect(status().isBadRequest());
  }
  @Test void rejectsInvalidLotsAndRollsBackIfExpenseCannotBeRecorded() throws Exception {
    String endpoint = "plans/" + approved(true) + "/applications";
    var request = application(5);
    request.remove("inventoryLotId");
    postAs(endpoint,request,1).andExpect(status().isBadRequest());
    long otherFarm = stockedLot(20,"FERT","Producto técnico","kg","OTRA",80,BigDecimal.ONE,null);
    request.put("inventoryLotId",otherFarm);
    postAs(endpoint,request,1).andExpect(status().isNotFound());
    long wrongProduct = stockedLot(10,"OTRO","Otro producto","kg","OTRO",80,BigDecimal.ONE,null);
    long wrongUnit = stockedLot(10,"LIQ","Producto técnico","L","LIQ",80,BigDecimal.ONE,null);
    long productId = queries.value("SELECT product_id FROM inventory_lot WHERE id=?", Long.class, stockLot);
    long expired = stockedLot(10, productId, "VENC", 80, BigDecimal.ONE, LocalDate.of(2026, 1, 11));
    long insufficient = stockedLot(10, productId, "BAJO", 4, BigDecimal.ONE, null);
    long unpriced = stockedLot(10, productId, "PRECIO", 80, null, null);
    for (long lotId : List.of(wrongProduct,wrongUnit,expired,insufficient,unpriced)) {
      request.put("inventoryLotId",lotId);
      postAs(endpoint,request,1).andExpect(status().isConflict());
    }

    request.put("inventoryLotId",stockLot);
    queries.execute("""
      INSERT INTO farm_financial_entry(farm_id,operation_id,entry_date,entry_type,category,amount,description,created_by,updated_by)
      VALUES (10,?,?,'EXPENSE','FERTILIZERS',7,'Movimiento manual',2,2)
      """, request.get("operationId"), LocalDate.of(2026,1,12));
    postAs(endpoint,request,1).andExpect(status().isConflict());
    assertThat(queries.value("SELECT COUNT(*) FROM field_event",Integer.class)).isZero();
    assertThat(queries.value("SELECT COUNT(*) FROM fertilization_application",Integer.class)).isZero();
    assertThat(queries.value("SELECT COUNT(*) FROM inventory_movement",Integer.class)).isZero();
    assertThat(queries.value("SELECT balance FROM inventory_lot WHERE id=?",BigDecimal.class,stockLot)).isEqualByComparingTo("60");
    assertThat(queries.value("SELECT status FROM farm_task",String.class)).isEqualTo("pending");
  }
  @Test void reportsAreAuthenticatedAndFollowupsValidateBlockAndTime() throws Exception {
    long id=approved(true);
    long sampleId=queries.value("SELECT analysis_id FROM fertilization_plan WHERE id=?",Long.class,id);
    var file=new MockMultipartFile("file","lab.pdf","application/pdf","%PDF-1.4\nExample".getBytes());
    mvc.perform(multipart("/api/v1/fertilization/analyses/"+sampleId+"/report").file(file).with(authentication(login(1))).with(csrf())).andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/fertilization/analyses/"+sampleId+"/report")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/fertilization/analyses/"+sampleId+"/report").with(authentication(login(1)))).andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options","nosniff")).andExpect(content().bytes(file.getBytes()));
    postAs("plans/"+id+"/followups",Map.of("analysisId",sampleId,"observations","Anterior"),2).andExpect(status().isBadRequest());
    var next=analysis(); next.put("sampledOn","2026-01-21"); long nextId=created("analyses",next,1).get("id").asLong();
    postAs("plans/"+id+"/followups",Map.of("analysisId",nextId,"observations","Comparación documentada"),2).andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/fertilization").param("farmId","10").with(authentication(login(2))))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.plans[0].followups[0].analysisId").value(nextId))
      .andExpect(jsonPath("$.plans[0].followups[0].reviewedBy").value(2))
      .andExpect(jsonPath("$.plans[0].followups[0].reviewedAt").isString());
    postAs("plans/"+id+"/followups",Map.of("observations","No autorizado"),1).andExpect(status().isForbidden());
    assertThat(service.latestSoil(12).get("id")).isEqualTo(nextId);
    next.put("sampleType","FOLIAR"); created("analyses",next,1);
    assertThat(service.latestSoil(12).get("id")).isEqualTo(nextId);
    assertThat(service.latestSoil(15)).isNull();
  }
  @Test void appliesOnlyTheBoundInventoryProductAndKeepsLongNames() throws Exception {
    long sampleId = created("analyses", analysis(), 1).get("id").asLong();
    String name = "Fertilizante de prueba " + "A".repeat(220);
    long selectedLot = stockedLot(10, "LARGO", name, "kg", "L".repeat(80), 60, BigDecimal.ONE, null);
    long homonymLot = stockedLot(10, "HOMONIMO", name, "kg", "LOTE-HOMONIMO", 60, BigDecimal.ONE, null);
    long selectedProductId = queries.value("SELECT product_id FROM inventory_lot WHERE id=?", Long.class, selectedLot);
    var request = plan(sampleId);
    request.put("product", name);
    postAs("plans", request, 2).andExpect(status().isConflict());
    request.remove("product");
    request.put("inventoryProductId", selectedProductId);
    var createdPlan = created("plans", request, 2);
    long planId = createdPlan.get("id").asLong();
    assertThat(createdPlan.get("inventoryProductId").asLong()).isEqualTo(selectedProductId);
    assertThat(createdPlan.get("product").asText()).isEqualTo(name);
    postAs("plans/" + planId + "/approve", Map.of("version", 0, "reason", "Revisión QA"), 2)
      .andExpect(status().isOk());
    postAs("plans/" + planId + "/task", Map.of(), 2).andExpect(status().isOk());
    String endpoint = "plans/" + planId + "/applications";
    var applicationRequest = application(5);
    applicationRequest.put("inventoryLotId", homonymLot);
    postAs(endpoint, applicationRequest, 1).andExpect(status().isConflict());
    applicationRequest.put("inventoryLotId", selectedLot);
    created(endpoint, applicationRequest, 1);
    assertThat(queries.value("SELECT description FROM farm_financial_entry", String.class)).contains(name);
    assertThat(queries.value("SELECT balance FROM inventory_lot WHERE id=?", BigDecimal.class, homonymLot)).isEqualByComparingTo("60");
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
  @Test void productCatalogAndRecurringPlansGenerateIdempotentOccurrences() throws Exception {
    var product = Map.of("farmId",10,"code","NPK-20","name","NPK Desarrollo","composition","20-10-20",
      "defaultDoseUnit","KG_HA","notes","Producto estandarizado para validación técnica");
    var createdProduct = json.readTree(postAs("products",product,2).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    assertThat(createdProduct.get("defaultDoseUnit").asText()).isEqualTo("KG_HA");
    mvc.perform(get("/api/v1/fertilization/products?farmId=10").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$[0].code").value("NPK-20"));

    long sampleId=created("analyses",analysis(),1).get("id").asLong();
    var mismatch=plan(sampleId); mismatch.put("productId",createdProduct.get("id").asLong());
    postAs("plans",mismatch,2).andExpect(status().isBadRequest());

    var recurring=plan(sampleId);
    recurring.put("productId",createdProduct.get("id").asLong()); recurring.put("product","Texto ignorado por catálogo"); recurring.put("composition","Texto ignorado por catálogo");
    recurring.put("dose",50); recurring.put("doseUnit","KG_HA"); recurring.put("coverage",2); recurring.put("recurrence","WEEKLY"); recurring.put("recurrenceUntil","2026-01-25");
    long planId=created("plans",recurring,2).get("id").asLong();
    postAs("plans/"+planId+"/approve",Map.of("version",0,"reason","Plan recurrente revisado"),2)
      .andExpect(status().isOk()).andExpect(jsonPath("$.recurrence").value("WEEKLY"))
      .andExpect(jsonPath("$.tasks.length()").value(3)).andExpect(jsonPath("$.totalQuantity").value(300))
      .andExpect(jsonPath("$.tasks[0].taskId").isNumber())
      .andExpect(jsonPath("$.tasks[0].occurrenceOn").value("2026-01-11"));
    postAs("plans/"+planId+"/task",Map.of(),2).andExpect(status().isOk()).andExpect(jsonPath("$.tasks.length()").value(3));
    assertThat(queries.value("SELECT COUNT(*) FROM farm_task",Integer.class)).isEqualTo(3);
    assertThat(queries.value("SELECT COUNT(*) FROM fertilization_plan_task WHERE plan_id=?",Integer.class,planId)).isEqualTo(3);

    var taskIds=queries.values("SELECT task_id FROM fertilization_plan_task WHERE plan_id=? ORDER BY occurrence_on",Long.class,planId);
    long recurringLot = stockedLot(10,"NPK","NPK Desarrollo","kg","L-001",250,BigDecimal.ONE,null);
    var firstApplication=new HashMap<String,Object>();
    firstApplication.put("occurredAt","2026-01-11T13:00:00Z"); firstApplication.put("quantity",100); firstApplication.put("coverage",2);
    firstApplication.put("method","Aplicación manual"); firstApplication.put("inventoryLotId",recurringLot); firstApplication.put("taskId",taskIds.get(0));
    firstApplication.put("operationId",UUID.randomUUID());
    created("plans/"+planId+"/applications",firstApplication,1);
    var secondApplication=new HashMap<>(firstApplication); secondApplication.put("taskId",taskIds.get(1)); secondApplication.put("occurredAt","2026-01-18T13:00:00Z"); secondApplication.put("operationId",UUID.randomUUID());
    created("plans/"+planId+"/applications",secondApplication,1);
    assertThat(queries.value("SELECT COUNT(*) FROM fertilization_application WHERE plan_id=?",Integer.class,planId)).isEqualTo(2);
    assertThat(queries.value("SELECT COUNT(*) FROM fertilization_application WHERE plan_id=? AND task_id=?",Integer.class,planId,taskIds.get(1))).isEqualTo(1);
  }
}
