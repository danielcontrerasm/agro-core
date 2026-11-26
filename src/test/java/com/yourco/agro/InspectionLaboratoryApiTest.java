package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.finances.FinanceService;
import com.yourco.agro.inspections.InspectionController;
import com.yourco.agro.inspections.InspectionLaboratoryController;
import com.yourco.agro.inspections.InspectionLaboratoryService;
import com.yourco.agro.inspections.InspectionService;
import com.yourco.agro.inventory.InventoryService;
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
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({InspectionController.class, InspectionLaboratoryController.class})
@Import({SecurityConfig.class, FarmAccess.class, InspectionService.class, InspectionLaboratoryService.class,
  InventoryService.class, FinanceService.class, InspectionLaboratoryApiTest.DatabaseConfig.class})
class InspectionLaboratoryApiTest {
  private static final String INSPECTION = "/api/v1/inspections/30";
  private static final String RESULTS = INSPECTION + "/laboratory-results";

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
        "db/migration/V34__inspection_laboratory_results.sql");
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;

  @BeforeEach
  void seed() {
    queries.execute("DELETE FROM phytosanitary_inspection");
    queries.execute("DELETE FROM farm_membership");
    queries.execute("DELETE FROM app_user");
    queries.execute("DELETE FROM block");
    queries.execute("DELETE FROM field");
    queries.execute("DELETE FROM farm");
    queries.execute("INSERT INTO farm VALUES (10, 'Norte'), (20, 'Sur')");
    queries.execute("INSERT INTO field VALUES (11, 10)");
    queries.execute("INSERT INTO block(id, field_id, area_ha) VALUES (12, 11, 20)");
    queries.execute("""
      INSERT INTO app_user(id, name, email, password_hash) VALUES
        (1, 'Operario', 'worker@example.com', 'hash'), (2, 'Supervisora', 'supervisor@example.com', 'hash'),
        (3, 'Otra finca', 'foreign@example.com', 'hash'), (4, 'Administradora', 'admin@example.com', 'hash')
      """);
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'WORKER'), (10, 2, 'SUPERVISOR'), (20, 3, 'ADMIN'), (10, 4, 'ADMIN')");
    queries.execute("""
      INSERT INTO phytosanitary_inspection (id, block_id, problem_code, inspected_at, inspected_plants,
        affected_plants, affected_area_ha, symptoms, severity_percent, severity_method, next_visit, created_by_user_id)
      VALUES (30, 12, 'SIGATOKA', ?, 20, 4, 1, 'Observación QA', 20, 'Visual', ?, 1)
      """, today().minusDays(3).atStartOfDay(ZoneOffset.UTC).toInstant(), today().plusDays(4));
  }

  @Test
  void retainsLaboratoryHistoryWithoutChangingFieldReview() throws Exception {
    postAs(RESULTS, 2, result("CONFIRMED")).andExpect(status().isCreated())
      .andExpect(jsonPath("$.inspectionId").value(30))
      .andExpect(jsonPath("$.sampleReference").value("Muestra-QA"))
      .andExpect(jsonPath("$.laboratory").value("Laboratorio QA"))
      .andExpect(jsonPath("$.sampledOn").value(today().minusDays(2).toString()))
      .andExpect(jsonPath("$.resultOn").value(today().toString()))
      .andExpect(jsonPath("$.outcome").value("CONFIRMED"))
      .andExpect(jsonPath("$.notes").value("Nota QA"))
      .andExpect(jsonPath("$.reportReference").value("Informe QA 001"))
      .andExpect(jsonPath("$.createdByUserId").value(2))
      .andExpect(jsonPath("$.createdByName").value("Supervisora"))
      .andExpect(jsonPath("$.createdAt").isNotEmpty());
    var earlier = result("INCONCLUSIVE");
    earlier.put("resultOn", today().minusDays(1));
    postAs(RESULTS, 4, earlier).andExpect(status().isCreated());
    postAs(RESULTS, 4, result("NOT_DETECTED")).andExpect(status().isCreated());
    mvc.perform(get(RESULTS).with(authentication(user(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(3))
      .andExpect(jsonPath("$[0].outcome").value("NOT_DETECTED"))
      .andExpect(jsonPath("$[1].outcome").value("CONFIRMED"))
      .andExpect(jsonPath("$[2].outcome").value("INCONCLUSIVE"));
    mvc.perform(get(INSPECTION).with(authentication(user(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.assessmentStatus").value("SUSPECTED"))
      .andExpect(jsonPath("$.version").value(0));
  }

  @Test
  void validatesDatesAndIdempotentRetries() throws Exception {
    var invalidDates = result("CONFIRMED");
    invalidDates.put("resultOn", today().minusDays(3));
    postAs(RESULTS, 2, invalidDates).andExpect(status().isBadRequest());
    invalidDates.put("resultOn", today().plusDays(1));
    postAs(RESULTS, 2, invalidDates).andExpect(status().isBadRequest());
    var invalidSample = result("CONFIRMED");
    invalidSample.put("sampleReference", " ");
    postAs(RESULTS, 2, invalidSample).andExpect(status().isBadRequest());

    var request = result("CONFIRMED");
    request.put("requestId", UUID.randomUUID());
    var response = postAs(RESULTS, 2, request).andExpect(status().isCreated()).andReturn();
    long resultId = json.readTree(response.getResponse().getContentAsString()).get("id").asLong();
    postAs(RESULTS, 2, request).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(resultId));
    postAs(RESULTS, 4, request).andExpect(status().isConflict());
    request.put("outcome", "NOT_DETECTED");
    postAs(RESULTS, 2, request).andExpect(status().isConflict());
    mvc.perform(get(RESULTS).with(authentication(user(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  void isolatesFarmsAndRetainsResultsAfterCancellation() throws Exception {
    var request = result("CONFIRMED");
    mvc.perform(get(RESULTS)).andExpect(status().isUnauthorized());
    mvc.perform(get(RESULTS).with(authentication(user(3)))).andExpect(status().isForbidden());
    postAs(RESULTS, 3, request).andExpect(status().isForbidden());
    postAs(RESULTS, 1, request).andExpect(status().isForbidden());
    mvc.perform(post(RESULTS).with(authentication(user(2))).contentType("application/json")
      .content(json.writeValueAsString(request))).andExpect(status().isForbidden());
    postAs(RESULTS, 2, request).andExpect(status().isCreated());
    postAs(INSPECTION + "/cancel", 2, Map.of("version", 0, "reason", "Inspección duplicada"))
      .andExpect(status().isOk());
    postAs(RESULTS, 2, request).andExpect(status().isConflict());
    mvc.perform(get(RESULTS).with(authentication(user(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].outcome").value("CONFIRMED"));
  }

  private Map<String, Object> result(String outcome) {
    return new LinkedHashMap<>(Map.of("sampleReference", " Muestra-QA ", "laboratory", " Laboratorio QA ",
      "sampledOn", today().minusDays(2), "resultOn", today(), "outcome", outcome,
      "notes", " Nota QA ", "reportReference", " Informe QA 001 "));
  }

  private ResultActions postAs(String path, int actor, Map<String, ?> payload) throws Exception {
    return mvc.perform(post(path).with(authentication(user(actor))).with(csrf()).contentType("application/json")
      .content(json.writeValueAsString(payload)));
  }

  private static UsernamePasswordAuthenticationToken user(int id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User((long) id, "Usuario QA", "qa@example.com"), null, List.of());
  }

  private static LocalDate today() {
    return LocalDate.now(ZoneOffset.UTC);
  }
}
