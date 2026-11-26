package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.finances.FinanceService;
import com.yourco.agro.inventory.InventoryService;
import com.yourco.agro.inspections.InspectionController;
import com.yourco.agro.inspections.InspectionMonitoringController;
import com.yourco.agro.inspections.InspectionMonitoringService;
import com.yourco.agro.inspections.InspectionService;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({InspectionController.class, InspectionMonitoringController.class})
@Import({SecurityConfig.class, FarmAccess.class, InspectionService.class, InspectionMonitoringService.class, InventoryService.class, FinanceService.class,
  InspectionMonitoringApiTest.DatabaseConfig.class})
@Transactional
class InspectionMonitoringApiTest {
  private static final String PLANS = "/api/v1/inspection-monitoring/plans";
  private static final String ALERTS = "/api/v1/inspection-monitoring/alerts";

  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class DatabaseConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database("auth-schema.sql", "db/migration/V2__users_and_memberships.sql",
        "db/migration/V6__phytosanitary_inspections.sql", "db/migration/V7__inspection_treatments_and_evidence.sql",
        "db/migration/V22__phytosanitary_catalog_and_inspection_area.sql",
        "db/migration/V28__phytosanitary_monitoring.sql");
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;
  private LocalDate today;

  @BeforeEach
  void seed() {
    today = LocalDate.now(ZoneOffset.UTC);
    queries.execute("INSERT INTO farm VALUES (10, 'Norte'), (20, 'Sur')");
    queries.execute("INSERT INTO field VALUES (11, 10), (21, 20)");
    queries.execute("INSERT INTO block VALUES (12, 11, 10), (14, 11, 20), (22, 21, 30)");
    queries.execute("INSERT INTO row_line VALUES (13, 12), (15, 14)");
    queries.execute("""
      INSERT INTO app_user(id, name, email, password_hash) VALUES
        (1, 'Operario', 'operario@example.com', 'hash'), (2, 'Supervisora', 'supervisora@example.com', 'hash'),
        (3, 'Vecino', 'vecino@example.com', 'hash')
      """);
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'WORKER'), (10, 2, 'SUPERVISOR'), (20, 3, 'ADMIN')");
  }

  @Test
  void matchesValidVisitsByBlockAndProblemAndReevaluatesAnAnnulledVisit() throws Exception {
    LocalDate start = today.minusDays(14);
    write(post(PLANS), 2, plan(start, 12, "picudos", 7, 30)).andExpect(status().isBadRequest());
    var created = write(post(PLANS), 2, plan(start, 12, "weevils", 7, 30)).andExpect(status().isCreated())
      .andExpect(jsonPath("problemCode").value("WEEVILS"))
      .andExpect(jsonPath("nextDueDate").value(start.toString()))
      .andExpect(jsonPath("overdue").value(true));
    long plan = identifier(created);

    visit(12, null, "WEEVILS", start.minusDays(1), 20);
    getList(PLANS, 1).andExpect(jsonPath("$[0].lastInspectionId").doesNotExist());
    long last = visit(12, null, "WEEVILS", today.minusDays(10), 20);
    visit(12, null, "SIGATOKA", today, 20);
    visit(14, null, "WEEVILS", today, 20);
    getList(PLANS, 1).andExpect(jsonPath("$[0].lastInspectionId").value(last))
      .andExpect(jsonPath("$[0].overdue").value(true));

    long rowVisit = visit(12, 13L, "WEEVILS", today, 1);
    getList(PLANS, 1).andExpect(jsonPath("$[0].lastInspectionId").value(rowVisit))
      .andExpect(jsonPath("$[0].lastInspectionDate").value(today.toString()))
      .andExpect(jsonPath("$[0].nextDueDate").value(today.plusDays(7).toString()))
      .andExpect(jsonPath("$[0].overdue").value(false));

    write(post("/api/v1/inspections/" + rowVisit + "/cancel"), 2, Map.of("version", 0, "reason", "Duplicada"))
      .andExpect(status().isOk());
    getList(PLANS, 1).andExpect(jsonPath("$[0].lastInspectionId").value(last))
      .andExpect(jsonPath("$[0].nextDueDate").value(today.minusDays(7).toString()))
      .andExpect(jsonPath("$[0].overdue").value(true));

    write(put(PLANS + "/" + plan), 2, Map.of("version", 0, "startDate", today.plusDays(2), "intervalDays", 14))
      .andExpect(status().isOk()).andExpect(jsonPath("intervalDays").value(14))
      .andExpect(jsonPath("nextDueDate").value(today.plusDays(2).toString()))
      .andExpect(jsonPath("lastInspectionDate").doesNotExist())
      .andExpect(jsonPath("incidenceThresholdPercent").doesNotExist());
  }

  @Test
  void persistsInclusiveThresholdAndTechnicalDecisionWithoutRetroactiveAlerts() throws Exception {
    long priorVisit = visit(12, null, "WEEVILS", today.minusDays(3), 20);
    long plan = identifier(write(post(PLANS), 2, plan(today.minusDays(4), 12, "WEEVILS", 7, 25))
      .andExpect(status().isCreated()).andExpect(jsonPath("lastInspectionId").value(priorVisit)));
    visit(12, null, "WEEVILS", today.minusDays(5), 20);
    visit(12, null, "WEEVILS", today, 4);
    getList(ALERTS, 1).andExpect(jsonPath("$.length()").value(0));
    long trigger = visit(12, null, "WEEVILS", today, 5);
    var result = getList(ALERTS, 1).andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].planId").value(plan)).andExpect(jsonPath("$[0].inspectionId").value(trigger))
      .andExpect(jsonPath("$[0].incidencePercent").value(25)).andExpect(jsonPath("$[0].thresholdPercent").value(25))
      .andExpect(jsonPath("$[0].status").value("OPEN")).andReturn();
    long alert = json.readTree(result.getResponse().getContentAsString()).get(0).get("id").asLong();

    write(patch(PLANS + "/" + plan), 2, Map.of("version", 0, "active", false))
      .andExpect(status().isOk()).andExpect(jsonPath("active").value(false)).andExpect(jsonPath("nextDueDate").doesNotExist());
    visit(12, null, "WEEVILS", today, 20);
    getList(ALERTS, 1).andExpect(jsonPath("$.length()").value(1));
    write(patch(PLANS + "/" + plan), 2, Map.of("version", 0, "active", true)).andExpect(status().isConflict());
    write(put(PLANS + "/" + plan), 2, Map.of("version", 1, "intervalDays", 7, "startDate", today.minusDays(4),
      "incidenceThresholdPercent", 40)).andExpect(status().isOk()).andExpect(jsonPath("active").value(false));
    write(patch(PLANS + "/" + plan), 2, Map.of("version", 2, "active", true)).andExpect(status().isOk());
    long second = visit(12, null, "WEEVILS", today, 9);
    getList(ALERTS, 1).andExpect(jsonPath("$.length()").value(2))
      .andExpect(jsonPath("$[0].inspectionId").value(second))
      .andExpect(jsonPath("$[0].thresholdPercent").value(40))
      .andExpect(jsonPath("$[1].thresholdPercent").value(25));

    var decision = Map.of("version", 0, "reviewNotes", "  Revisar en visita de campo  ");
    write(post(ALERTS + "/" + alert + "/review"), 1, decision).andExpect(status().isForbidden());
    write(post(ALERTS + "/" + alert + "/review"), 3, decision).andExpect(status().isForbidden());
    write(post(ALERTS + "/" + alert + "/review"), 2, Map.of("version", 0, "reviewNotes", " ")).andExpect(status().isBadRequest());
    write(post(ALERTS + "/" + alert + "/review"), 2, decision)
      .andExpect(status().isOk()).andExpect(jsonPath("status").value("REVIEWED"))
      .andExpect(jsonPath("reviewedByUserId").value(2)).andExpect(jsonPath("reviewedAt").exists())
      .andExpect(jsonPath("reviewNotes").value("Revisar en visita de campo")).andExpect(jsonPath("version").value(1));
    write(post(ALERTS + "/" + alert + "/review"), 2, decision).andExpect(status().isConflict());
    write(post("/api/v1/inspections/" + trigger + "/cancel"), 2, Map.of("version", 0, "reason", "Muestra anulada"))
      .andExpect(status().isOk());
    getList(ALERTS, 1).andExpect(jsonPath("$[1].status").value("REVIEWED"))
      .andExpect(jsonPath("$[1].inspectionCanceledAt").exists());
  }

  @Test
  void rejectsUnscopedWritesDuplicatesAndInvalidRules() throws Exception {
    var request = plan(today, 12, "WEEVILS", 7, 24.5);
    write(post(PLANS), 1, request).andExpect(status().isForbidden());
    mvc.perform(post(PLANS).with(authentication(login(2))).contentType("application/json")
      .content(json.writeValueAsString(request))).andExpect(status().isForbidden());
    write(post(PLANS), 2, plan(today, 22, "WEEVILS", 7, 25)).andExpect(status().isForbidden());
    write(post(PLANS), 2, plan(today, 12, "WEEVILS", 0, 25)).andExpect(status().isBadRequest());
    write(post(PLANS), 2, plan(today, 12, "WEEVILS", 7, 101)).andExpect(status().isBadRequest());
    mvc.perform(get(ALERTS).param("farmId", "20").with(authentication(login(1)))).andExpect(status().isForbidden());
    mvc.perform(get(PLANS).param("farmId", "10").with(authentication(login(3)))).andExpect(status().isForbidden());

    long plan = identifier(write(post(PLANS), 2, request).andExpect(status().isCreated())
      .andExpect(jsonPath("incidenceThresholdPercent").value(24.5)));
    write(patch(PLANS + "/" + plan), 3, Map.of("version", 0, "active", false)).andExpect(status().isForbidden());
    write(post(PLANS), 2, request).andExpect(status().isConflict());
  }

  private ResultActions getList(String path, long user) throws Exception {
    return mvc.perform(get(path).param("farmId", "10").with(authentication(login(user)))).andExpect(status().isOk());
  }

  private long visit(long block, Long row, String problem, LocalDate day, int affected) throws Exception {
    var payload = new java.util.HashMap<String, Object>(Map.of(
      "blockId", block, "problemCode", problem, "inspectedAt", day.atStartOfDay().toInstant(ZoneOffset.UTC),
      "inspectedPlants", 20, "affectedPlants", affected, "affectedAreaHa", 0.1,
      "symptoms", "Observación de prueba", "severityPercent", 2, "severityMethod", "Evaluación visual",
      "nextVisit", day.plusDays(7)));
    if (row != null) payload.put("rowId", row);
    return identifier(write(post("/api/v1/inspections"), 1, payload).andExpect(status().isOk()));
  }

  private Map<String, Object> plan(LocalDate start, long block, String problem, int interval, Number threshold) {
    return Map.of("farmId", 10, "blockId", block, "problemCode", problem, "startDate", start,
      "intervalDays", interval, "incidenceThresholdPercent", threshold);
  }

  private ResultActions write(MockHttpServletRequestBuilder request, long user, Map<String, ?> payload) throws Exception {
    return mvc.perform(request.with(authentication(login(user))).with(csrf())
      .contentType("application/json").content(json.writeValueAsString(payload)));
  }

  private long identifier(ResultActions actions) throws Exception {
    return json.readTree(actions.andReturn().getResponse().getContentAsString()).get("id").asLong();
  }

  private UsernamePasswordAuthenticationToken login(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User(id, "Inspector", "user@example.com"), null, List.of());
  }
}
