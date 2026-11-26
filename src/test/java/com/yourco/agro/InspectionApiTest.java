package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.finances.FinanceService;
import com.yourco.agro.inventory.InventoryService;
import com.yourco.agro.inspections.*;
import com.yourco.agro.persistence.JpaSql;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(InspectionController.class)
@Import({SecurityConfig.class, FarmAccess.class, InspectionService.class, InventoryService.class, FinanceService.class, InspectionApiTest.DatabaseConfig.class})
class InspectionApiTest {
  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class DatabaseConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database(
        "auth-schema.sql",
        "db/migration/V2__users_and_memberships.sql",
        "db/migration/V6__phytosanitary_inspections.sql",
        "db/migration/V7__inspection_treatments_and_evidence.sql",
        "db/migration/V8__photos.sql",
        "db/migration/V22__phytosanitary_catalog_and_inspection_area.sql",
        "db/migration/V25__inventory.sql", "db/migration/V26__farm_finances.sql",
        "db/migration/V29__inspection_treatment_followups.sql", "db/migration/V30__inventory_application_costs.sql",
        "db/migration/V32__treatment_application_inventory.sql"
      );
    }
  }
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;
  @Autowired InspectionService service;

  private UsernamePasswordAuthenticationToken login(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User(id, "Inspector", "user@example.com"), null, List.of());
  }

  @BeforeEach
  void seed() {
    queries.execute("DELETE FROM inspection_evidence"); queries.execute("DELETE FROM inspection_treatment");
    queries.execute("DELETE FROM phytosanitary_inspection"); queries.execute("DELETE FROM farm_membership");
    queries.execute("DELETE FROM app_user"); queries.execute("DELETE FROM row_line"); queries.execute("DELETE FROM block");
    queries.execute("DELETE FROM field"); queries.execute("DELETE FROM farm");
    queries.execute("INSERT INTO farm VALUES (10, 'North'), (20, 'South')");
    queries.execute("INSERT INTO field VALUES (11, 10), (21, 20)");
    queries.execute("INSERT INTO block(id, field_id, area_ha) VALUES (12, 11, 28), (15, 11, 18), (22, 21, 10)");
    queries.execute("INSERT INTO row_line VALUES (13, 12), (16, 15), (23, 22)");
    queries.execute("INSERT INTO app_user(id, name, email, password_hash) VALUES (1, 'Worker', 'worker@example.com', 'hash'), (2, 'Manager', 'manager@example.com', 'hash')");
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'WORKER'), (10, 2, 'ADMIN')");
  }

  private Map<String, Object> payload() {
    return new HashMap<>(Map.of("blockId", 12, "problemCode", "SIGATOKA", "inspectedAt", "2026-01-10T12:00:00Z",
      "inspectedPlants", 20, "affectedPlants", 4, "affectedAreaHa", 2.5, "symptoms", "Manchas foliares", "severityPercent", 15,
      "severityMethod", "Porcentaje visual de tejido afectado", "nextVisit", "2026-01-20"));
  }

  private long create(Map<String, Object> payload) throws Exception {
    var result = mvc.perform(post("/api/v1/inspections").with(authentication(login(1))).with(csrf())
      .contentType("application/json").content(json.writeValueAsString(payload)))
      .andExpect(status().isOk()).andExpect(jsonPath("incidencePercent").value(20))
      .andExpect(jsonPath("assessmentStatus").value("SUSPECTED"))
      .andExpect(jsonPath("createdByUserId").value(1)).andReturn();
    return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
  }

  @Test void roundTripFiltersReviewPermissionsAndStaleVersion() throws Exception {
    long id = create(payload());
    mvc.perform(get("/api/v1/phytosanitary-problems").param("farmId", "10").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(6));
    mvc.perform(get("/api/v1/inspections").param("farmId", "10").param("problemCode", "SIGATOKA").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].affectedAreaHa").value(2.5));
    mvc.perform(get("/api/v1/inspections").param("problemCode", "MOKO").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    mvc.perform(get("/api/v1/inspections").param("from", "2026-02-01T00:00:00Z").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    String review = "{\"assessmentStatus\":\"DISCARDED\",\"resolved\":true,\"reviewNotes\":\"Evaluación técnica\",\"version\":0}";
    mvc.perform(patch("/api/v1/inspections/" + id).with(authentication(login(1))).with(csrf()).contentType("application/json").content(review)).andExpect(status().isForbidden());
    mvc.perform(patch("/api/v1/inspections/" + id).with(authentication(login(2))).with(csrf()).contentType("application/json").content(review))
      .andExpect(status().isOk()).andExpect(jsonPath("resolved").value(true)).andExpect(jsonPath("reviewedByUserId").value(2));
    mvc.perform(patch("/api/v1/inspections/" + id).with(authentication(login(2))).with(csrf()).contentType("application/json").content(review)).andExpect(status().isConflict());
  }

  @Test void rejectsInvalidCountsMethodsTargetsAndMissingCsrf() throws Exception {
    for (var invalid : List.of(Map.of("affectedPlants", 21), Map.of("affectedAreaHa", -1), Map.of("inspectedPlants", 0), Map.of("severityPercent", 101),
      Map.of("severityMethod", " "), Map.of("problemCode", "UNKNOWN"), Map.of("rowId", 16), Map.of("nextVisit", "2025-12-01"))) {
      var request = payload(); request.putAll(invalid);
      mvc.perform(post("/api/v1/inspections").with(authentication(login(1))).with(csrf()).contentType("application/json").content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
    }
    var request = payload(); request.put("blockId", 22);
    mvc.perform(post("/api/v1/inspections").with(authentication(login(1))).with(csrf()).contentType("application/json").content(json.writeValueAsString(request))).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/inspections").param("farmId", "20").with(authentication(login(1)))).andExpect(status().isForbidden());
    mvc.perform(post("/api/v1/inspections").with(authentication(login(1))).contentType("application/json").content(json.writeValueAsString(payload()))).andExpect(status().isForbidden());
  }

  @Test void sanitaryCatalogCanBeManagedWithoutDeletingHistory() throws Exception {
    mvc.perform(post("/api/v1/phytosanitary-problems").with(authentication(login(2))).with(csrf())
        .contentType("application/json").content("{\"farmId\":10,\"code\":\"trips\",\"name\":\"Trips\",\"category\":\"PEST\"}"))
      .andExpect(status().isCreated()).andExpect(jsonPath("code").value("TRIPS"));
    mvc.perform(post("/api/v1/phytosanitary-problems").with(authentication(login(1))).with(csrf())
        .contentType("application/json").content("{\"farmId\":10,\"code\":\"APHIDS\",\"name\":\"Áfidos\",\"category\":\"PEST\"}"))
      .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/phytosanitary-problems").param("farmId", "10").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(7));
    mvc.perform(patch("/api/v1/phytosanitary-problems/TRIPS").with(authentication(login(2))).with(csrf())
        .contentType("application/json").content("{\"farmId\":10,\"name\":\"Trips de la hoja\",\"category\":\"PEST\",\"active\":false}"))
      .andExpect(status().isOk()).andExpect(jsonPath("name").value("Trips de la hoja")).andExpect(jsonPath("active").value(false));
    mvc.perform(get("/api/v1/phytosanitary-problems").param("farmId", "10").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(6));
    mvc.perform(get("/api/v1/phytosanitary-problems").param("farmId", "10").param("includeInactive", "true").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(7)).andExpect(jsonPath("$[6].code").value("TRIPS"))
      .andExpect(jsonPath("$[6].active").value(false));
  }

  @Test void mapSeparatesMissingStaleActiveAndResolvedInspections() throws Exception {
    long id = create(payload());
    SecurityContextHolder.getContext().setAuthentication(login(2));
    try {
      assertThat(service.healthStatus(15L, LocalDate.of(2026, 1, 12))).isEqualTo("NO_RECENT_INSPECTION");
      assertThat(service.healthStatus(12L, LocalDate.of(2026, 1, 12))).isEqualTo("ACTIVE_FINDINGS");
      assertThat(service.healthStatus(12L, LocalDate.of(2026, 2, 12))).isEqualTo("NO_RECENT_INSPECTION");
      service.review(id, new InspectionDtos.ReviewRequest(InspectionDtos.AssessmentStatus.DISCARDED, true, "Descartado", 0L));
      assertThat(service.healthStatus(12L, LocalDate.of(2026, 1, 12))).isEqualTo("NO_ACTIVE_FINDINGS");
    } finally { SecurityContextHolder.clearContext(); }
  }

  @Test void treatmentsAndEvidenceRemainLinkedAndRespectFarmAccess() throws Exception {
    long id = create(payload());
    var treatment = mvc.perform(post("/api/v1/inspections/" + id + "/treatments").with(authentication(login(1))).with(csrf())
      .contentType("application/json").content("{\"occurredAt\":\"2026-01-11T12:00:00Z\",\"description\":\"Deshoje sanitario según plan\"}"))
      .andExpect(status().isOk()).andExpect(jsonPath("authorName").value("Worker")).andReturn();
    long treatmentId = json.readTree(treatment.getResponse().getContentAsString()).get("id").asLong();
    mvc.perform(post("/api/v1/inspections/" + id + "/evidence").with(authentication(login(1))).with(csrf())
      .contentType("application/json").content(json.writeValueAsString(Map.of("treatmentId", treatmentId, "kind", "IMAGE", "s3Key", "inspections/evidence.jpg"))))
      .andExpect(status().isOk()).andExpect(jsonPath("inspectionId").value(id)).andExpect(jsonPath("treatmentId").value(treatmentId));
    long otherId = create(payload());
    mvc.perform(post("/api/v1/inspections/" + otherId + "/evidence").with(authentication(login(1))).with(csrf())
      .contentType("application/json").content(json.writeValueAsString(Map.of("treatmentId", treatmentId, "kind", "IMAGE", "s3Key", "wrong.jpg"))))
      .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/inspections/" + id + "/treatments").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(post("/api/v1/inspections/" + id + "/treatments").with(authentication(login(1))).with(csrf())
      .contentType("application/json").content("{\"occurredAt\":\"2026-01-11T12:00:00Z\",\"description\":\"Incomplete quantity\",\"quantity\":2}"))
      .andExpect(status().isBadRequest());
    mvc.perform(post("/api/v1/inspections/" + id + "/cancel").with(authentication(login(2))).with(csrf())
      .contentType("application/json").content("{\"reason\":\"Duplicado\",\"version\":0}")).andExpect(status().isOk());
    mvc.perform(get("/api/v1/inspections/" + id + "/treatments").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(get("/api/v1/inspections/" + id + "/evidence").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$[0].s3Key").value("inspections/evidence.jpg"));
    queries.execute("DELETE FROM farm_membership WHERE user_id = 1");
    mvc.perform(get("/api/v1/inspections/" + id + "/evidence").with(authentication(login(1)))).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/inspections/" + id + "/treatments").with(authentication(login(1)))).andExpect(status().isForbidden());
    mvc.perform(post("/api/v1/inspections/" + id + "/evidence").with(authentication(login(1))).with(csrf())
      .contentType("application/json").content("{\"kind\":\"IMAGE\",\"s3Key\":\"denied.jpg\"}")).andExpect(status().isForbidden());
  }

  @Test void cancellationRequiresManagerReasonAndVersionAndPreservesHistory() throws Exception {
    long id = create(payload());
    String path = "/api/v1/inspections/" + id;
    String cancellation = "{\"reason\":\"Registro duplicado\",\"version\":0}";
    mvc.perform(post(path + "/cancel").with(authentication(login(1))).with(csrf()).contentType("application/json").content(cancellation)).andExpect(status().isForbidden());
    mvc.perform(post(path + "/cancel").with(authentication(login(2))).with(csrf()).contentType("application/json").content("{\"reason\":\" \",\"version\":0}")).andExpect(status().isBadRequest());
    mvc.perform(post(path + "/cancel").with(authentication(login(2))).with(csrf()).contentType("application/json").content("{\"reason\":\"Duplicado\",\"version\":99}")).andExpect(status().isConflict());
    mvc.perform(post(path + "/cancel").with(authentication(login(2))).with(csrf()).contentType("application/json").content(cancellation))
      .andExpect(status().isOk()).andExpect(jsonPath("canceledByUserId").value(2)).andExpect(jsonPath("cancellationReason").value("Registro duplicado"));
    mvc.perform(get(path).with(authentication(login(1)))).andExpect(status().isOk()).andExpect(jsonPath("canceledAt").isNotEmpty());
    mvc.perform(post(path + "/treatments").with(authentication(login(1))).with(csrf()).contentType("application/json")
      .content("{\"occurredAt\":\"2026-01-11T12:00:00Z\",\"description\":\"Bloqueado\"}")).andExpect(status().isConflict());
    mvc.perform(post(path + "/evidence").with(authentication(login(1))).with(csrf()).contentType("application/json")
      .content("{\"kind\":\"DOCUMENT\",\"s3Key\":\"blocked.pdf\"}")).andExpect(status().isConflict());
    SecurityContextHolder.getContext().setAuthentication(login(2));
    try { assertThat(service.healthStatus(12L, LocalDate.of(2026, 1, 12))).isEqualTo("NO_RECENT_INSPECTION"); }
    finally { SecurityContextHolder.clearContext(); }
  }

  @Test void followUpMustPreserveProblemAndLocationAndKeepsParentLink() throws Exception {
    long id = create(payload());
    var followUp = payload(); followUp.put("parentInspectionId", id); followUp.put("inspectedAt", "2026-01-12T12:00:00Z");
    long followUpId = create(followUp);
    mvc.perform(get("/api/v1/inspections/" + followUpId).with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("parentInspectionId").value(id));
    followUp.put("problemCode", "MOKO");
    mvc.perform(post("/api/v1/inspections").with(authentication(login(1))).with(csrf()).contentType("application/json").content(json.writeValueAsString(followUp))).andExpect(status().isBadRequest());
  }
}
