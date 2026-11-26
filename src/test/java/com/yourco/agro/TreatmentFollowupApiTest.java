package com.yourco.agro;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.inspections.InspectionController;
import com.yourco.agro.inspections.InspectionService;
import com.yourco.agro.inspections.TreatmentFollowupController;
import com.yourco.agro.inspections.TreatmentFollowupService;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({InspectionController.class, TreatmentFollowupController.class})
@Import({SecurityConfig.class, FarmAccess.class, InspectionService.class,
  TreatmentFollowupService.class, TreatmentFollowupApiTest.DatabaseConfig.class})
class TreatmentFollowupApiTest {
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
        "db/migration/V22__phytosanitary_catalog_and_inspection_area.sql",
        "db/migration/V29__inspection_treatment_followups.sql");
    }
  }

  private static final String API = "/api/v1/inspections";
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;

  @BeforeEach
  void seed() {
    queries.execute("DELETE FROM inspection_treatment_followup");
    queries.execute("DELETE FROM inspection_evidence");
    queries.execute("DELETE FROM inspection_treatment");
    queries.execute("DELETE FROM phytosanitary_inspection");
    queries.execute("DELETE FROM farm_membership");
    queries.execute("DELETE FROM app_user");
    queries.execute("DELETE FROM row_line");
    queries.execute("DELETE FROM block");
    queries.execute("DELETE FROM field");
    queries.execute("DELETE FROM farm");
    queries.execute("INSERT INTO farm VALUES (10, 'Norte'), (20, 'Sur')");
    queries.execute("INSERT INTO field VALUES (11, 10), (21, 20)");
    queries.execute("INSERT INTO block(id, field_id, area_ha) VALUES (12, 11, 20), (22, 21, 18)");
    queries.execute("""
      INSERT INTO app_user(id, name, email, password_hash) VALUES
        (1, 'Operario', 'worker@example.com', 'hash'), (2, 'Supervisora', 'supervisor@example.com', 'hash'),
        (3, 'Agrónoma', 'agronomist@example.com', 'hash'), (4, 'Otro administrador', 'foreign@example.com', 'hash')
      """);
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'WORKER'), (10, 2, 'SUPERVISOR'), (10, 3, 'ADMIN'), (20, 4, 'ADMIN')");
  }

  @Test
  void authorizesExecutesAndVerifiesWithLotAndRetainsEvidenceAndLegacyRecords() throws Exception {
    long inspectionId = inspection(12, 1);
    String inspectionPath = API + "/" + inspectionId;
    String followups = inspectionPath + "/treatment-followups";
    long legacyId = record(postAs(inspectionPath + "/treatments", 1,
      Map.of("description", "Registro previo", "occurredAt", now())).andExpect(status().isOk())).get("id").asLong();

    String requestId = UUID.randomUUID().toString();
    var authorization = Map.of("description", "Registro operativo QA", "product", "Insumo simulado", "requestId", requestId);
    JsonNode authorized = record(postAs(followups, 3, authorization).andExpect(status().isCreated())
      .andExpect(jsonPath("$.status").value("AUTHORIZED"))
      .andExpect(jsonPath("$.authorizedByUserId").value(3))
      .andExpect(jsonPath("$.authorizedByName").value("Agrónoma"))
      .andExpect(jsonPath("$.authorizedAt").isNotEmpty())
      .andExpect(jsonPath("$.version").value(0)));
    long id = authorized.get("id").asLong();
    postAs(followups, 3, authorization).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(id));
    postAs(followups, 3, Map.of("description", "Otra autorización", "requestId", requestId))
      .andExpect(status().isConflict());

    String followup = followups + "/" + id;
    var execution = Map.of("version", 0, "occurredAt", now(), "productLot", "  LOTE-QA-01  ", "quantity", 2.5, "unit", "kg");
    JsonNode executed = record(postAs(followup + "/execute", 1, execution).andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("EXECUTED")).andExpect(jsonPath("$.productLot").value("LOTE-QA-01"))
      .andExpect(jsonPath("$.executedByName").value("Operario")).andExpect(jsonPath("$.executedAt").isNotEmpty())
      .andExpect(jsonPath("$.quantity").value(2.5)).andExpect(jsonPath("$.unit").value("kg"))
      .andExpect(jsonPath("$.version").value(1)));
    long newTreatmentId = executed.get("treatmentId").asLong();
    postAs(followup + "/execute", 1, execution).andExpect(status().isConflict());
    postAs(inspectionPath + "/evidence", 1, Map.of("treatmentId", newTreatmentId, "kind", "IMAGE",
      "s3Key", "qa/registro.png")).andExpect(status().isOk()).andExpect(jsonPath("$.treatmentId").value(newTreatmentId));
    postAs(followup + "/verify", 2, Map.of("version", 1, "verifiedAt", now(), "outcome", "PARTIAL", "notes", "Observación de QA"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("VERIFIED")).andExpect(jsonPath("$.version").value(2))
      .andExpect(jsonPath("$.verifiedByUserId").value(2)).andExpect(jsonPath("$.verifiedByName").value("Supervisora"))
      .andExpect(jsonPath("$.verifiedAt").isNotEmpty()).andExpect(jsonPath("$.outcome").value("PARTIAL"))
      .andExpect(jsonPath("$.verificationNotes").value("Observación de QA"));

    mvc.perform(get(followups).with(authentication(user(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].treatmentId").value(newTreatmentId))
      .andExpect(jsonPath("$[0].status").value("VERIFIED"));
    mvc.perform(get(inspectionPath + "/treatments").with(authentication(user(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0].id").value(newTreatmentId))
      .andExpect(jsonPath("$[1].id").value(legacyId));
    mvc.perform(get(inspectionPath + "/evidence").with(authentication(user(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$[0].treatmentId").value(newTreatmentId));
  }

  @Test
  void enforcesVersionChronologyAndOptionalProductRules() throws Exception {
    String followups = API + "/" + inspection(12, 1) + "/treatment-followups";
    long id = record(postAs(followups, 2, Map.of("description", "Intervención", "product", "Insumo QA"))
      .andExpect(status().isCreated())).get("id").asLong();
    String followup = followups + "/" + id;
    postAs(followup + "/verify", 3, Map.of("version", 0, "verifiedAt", now(), "outcome", "PARTIAL", "notes", "QA"))
      .andExpect(status().isConflict());
    postAs(followup + "/execute", 1, Map.of("version", 2, "occurredAt", now(), "productLot", "LOTE-QA"))
      .andExpect(status().isConflict());
    postAs(followup + "/execute", 1, Map.of("version", 0, "occurredAt", Instant.now().minus(1, ChronoUnit.HOURS).toString(),
      "productLot", "LOTE-QA")).andExpect(status().isBadRequest());
    postAs(followup + "/execute", 1, Map.of("version", 0, "occurredAt", now()))
      .andExpect(status().isBadRequest());
    postAs(followup + "/execute", 1, Map.of("version", 0, "occurredAt", now(), "productLot", "LOTE-QA", "quantity", 3))
      .andExpect(status().isBadRequest());
    postAs(followup + "/execute", 1, Map.of("version", 0, "occurredAt", now(), "productLot", "LOTE-QA"))
      .andExpect(status().isOk());
    postAs(followup + "/verify", 3, Map.of("version", 1, "verifiedAt", Instant.now().minus(1, ChronoUnit.HOURS).toString(),
      "outcome", "EFFECTIVE", "notes", "QA")).andExpect(status().isBadRequest());
    postAs(followup + "/verify", 3, Map.of("version", 1, "verifiedAt", now(), "outcome", "EFFECTIVE", "notes", " "))
      .andExpect(status().isBadRequest());

    long noProductId = record(postAs(followups, 2, Map.of("description", "Intervención sin producto"))
      .andExpect(status().isCreated())).get("id").asLong();
    String noProduct = followups + "/" + noProductId + "/execute";
    postAs(noProduct, 1, Map.of("version", 0, "occurredAt", now(), "productLot", "LOTE-QA"))
      .andExpect(status().isBadRequest());
    postAs(noProduct, 1, Map.of("version", 0, "occurredAt", now()))
      .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("EXECUTED"));
  }

  @Test
  void restrictsWritesAndKeepsCanceledInspectionHistoryReadable() throws Exception {
    String inspection = API + "/" + inspection(12, 1);
    String followups = inspection + "/treatment-followups";
    Map<String, Object> authorization = Map.of("description", "Registro operativo QA");
    postAs(followups, 1, authorization).andExpect(status().isForbidden());
    mvc.perform(post(followups).with(authentication(user(2))).contentType("application/json")
      .content(json.writeValueAsString(authorization))).andExpect(status().isForbidden());
    mvc.perform(get(followups).with(authentication(user(4)))).andExpect(status().isForbidden());
    long id = record(postAs(followups, 3, authorization).andExpect(status().isCreated())).get("id").asLong();
    String followup = followups + "/" + id;
    String foreignFarm = API + "/" + inspection(22, 4);
    postAs(foreignFarm + "/treatment-followups/" + id + "/execute", 4, Map.of("version", 0, "occurredAt", now()))
      .andExpect(status().isNotFound());
    postAs(followup + "/execute", 4, Map.of("version", 0, "occurredAt", now())).andExpect(status().isForbidden());
    postAs(followup + "/execute", 1, Map.of("version", 0, "occurredAt", now())).andExpect(status().isOk());
    var verification = Map.of("version", 1, "verifiedAt", now(), "outcome", "EFFECTIVE", "notes", "QA");
    postAs(followup + "/verify", 1, verification).andExpect(status().isForbidden());
    postAs(inspection + "/cancel", 2, Map.of("version", 0, "reason", "Registro de prueba")).andExpect(status().isOk());
    postAs(followup + "/verify", 2, verification).andExpect(status().isConflict());
    postAs(followups, 2, authorization).andExpect(status().isConflict());
    mvc.perform(get(followups).with(authentication(user(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$[0].status").value("EXECUTED"));
  }

  private long inspection(int block, int actor) throws Exception {
    return record(postAs(API, actor, Map.of("blockId", block, "problemCode", "SIGATOKA",
      "inspectedAt", Instant.now().minus(1, ChronoUnit.DAYS).toString(), "inspectedPlants", 20, "affectedPlants", 4,
      "affectedAreaHa", 1, "symptoms", "Observación QA", "severityPercent", 20, "severityMethod", "Evaluación visual",
      "nextVisit", LocalDate.now(ZoneOffset.UTC).plusDays(3).toString())).andExpect(status().isOk())).get("id").asLong();
  }

  private ResultActions postAs(String path, int actor, Map<String, ?> payload) throws Exception {
    return mvc.perform(post(path).with(authentication(user(actor))).with(csrf()).contentType("application/json")
      .content(json.writeValueAsString(payload)));
  }

  private UsernamePasswordAuthenticationToken user(int id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User((long) id, "Usuario QA", "qa@example.com"), null, List.of());
  }

  private JsonNode record(ResultActions result) throws Exception {
    return json.readTree(result.andReturn().getResponse().getContentAsString());
  }

  private String now() {
    return Instant.now().truncatedTo(ChronoUnit.MILLIS).toString();
  }
}
