package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.finances.FinanceController;
import com.yourco.agro.finances.FinanceService;
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
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FinanceController.class)
@Import({ SecurityConfig.class, FarmAccess.class, FinanceService.class, FinanceApiTest.DatabaseConfig.class })
@Transactional
class FinanceApiTest {
  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class DatabaseConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database("auth-schema.sql", "db/migration/V2__users_and_memberships.sql",
        "finance-schema.sql", "db/migration/V25__inventory.sql", "db/migration/V26__farm_finances.sql",
        "db/migration/V30__inventory_application_costs.sql");
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;

  @BeforeEach
  void seed() {
    queries.execute("INSERT INTO farm VALUES (10, 'Norte'), (20, 'Sur')");
    queries.execute("INSERT INTO field(id, farm_id, name) VALUES (11, 10, 'División norte'), (21, 20, 'División sur')");
    queries.execute("INSERT INTO block(id, field_id, code) VALUES (12, 11, 'A'), (22, 21, 'B')");
    queries.execute("""
      INSERT INTO app_user(id, name, email, password_hash) VALUES
        (1, 'Admin', 'admin@example.com', 'hash'), (2, 'Supervisor', 'supervisor@example.com', 'hash'),
        (3, 'Otro admin', 'other@example.com', 'hash')
      """);
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'ADMIN'), (10, 2, 'SUPERVISOR'), (20, 3, 'ADMIN')");
  }

  @Test
  void computesMonthlyTotalsAndMarginsInCopAndUpsertsBudget() throws Exception {
    var expense = entry("2026-11-01", "EXPENSE", "IRRIGATION_ENERGY", 35.75, 12);
    var payload = Map.of("farmId", 10, "operationId", UUID.randomUUID(), "entry", expense);
    var result = mvc.perform(post("/api/v1/finances/entries").with(authentication(login(1))).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(payload)))
      .andExpect(status().isCreated()).andExpect(jsonPath("$.fieldId").value(11)).andReturn();
    long expenseId = json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    mvc.perform(post("/api/v1/finances/entries").with(authentication(login(1))).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(payload)))
      .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(is(expenseId), Long.class));
    var changed = Map.of("farmId", 10, "operationId", payload.get("operationId"),
      "entry", entry("2026-11-01", "EXPENSE", "IRRIGATION_ENERGY", 50, 12));
    mvc.perform(post("/api/v1/finances/entries").with(authentication(login(1))).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(changed)))
      .andExpect(status().isConflict());

    create(1, 10, entry("2026-11-30", "INCOME", "CROP_SALE", 150.25, 12));
    create(1, 10, entry("2026-12-01", "EXPENSE", "FERTILIZERS", 999, 12));
    saveBudget(10, 1, "2026-11", 50);
    saveBudget(10, 1, "2026-11", 85.50);
    mvc.perform(get("/api/v1/finances").param("farmId", "10").param("month", "2026-11").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.currency").value("COP"))
      .andExpect(jsonPath("$.totals.expenses").value(35.75)).andExpect(jsonPath("$.totals.income").value(150.25))
      .andExpect(jsonPath("$.totals.margin").value(114.50)).andExpect(jsonPath("$.totals.entryCount").value(2))
      .andExpect(jsonPath("$.expensesByCategory[0].category").value("IRRIGATION_ENERGY"))
      .andExpect(jsonPath("$.blockMargins[0].blockCode").value("A"))
      .andExpect(jsonPath("$.blockMargins[0].margin").value(114.50))
      .andExpect(jsonPath("$.budget.amount").value(85.50)).andExpect(jsonPath("$.entries.length()").value(2));

    var edit = Map.of("farmId", 10, "version", 0, "entry", entry("2026-12-01", "EXPENSE", "LABOR", 30.25, 12));
    mvc.perform(patch("/api/v1/finances/entries/{id}", expenseId).with(authentication(login(1))).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(edit)))
      .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
    mvc.perform(patch("/api/v1/finances/entries/{id}", expenseId).with(authentication(login(1))).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(edit))).andExpect(status().isConflict());
    mvc.perform(get("/api/v1/finances").param("farmId", "10").param("month", "2026-11").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.totals.entryCount").value(1));
  }

  @Test
  void restrictsFinancialReadsAndWritesAndRejectsForeignBlocks() throws Exception {
    for (long userId : List.of(2L, 3L)) {
      mvc.perform(get("/api/v1/finances").param("farmId", "10").param("month", "2026-11").with(authentication(login(userId))))
        .andExpect(status().isForbidden());
      mvc.perform(put("/api/v1/finances/budget").with(authentication(login(userId))).with(csrf())
          .contentType("application/json").content("{\"farmId\":10,\"month\":\"2026-11\",\"amount\":10}"))
        .andExpect(status().isForbidden());
    }
    for (var badEntry : List.of(entry("2026-11-01", "EXPENSE", "LABOR", 10, 22),
      entry("2026-11-01", "EXPENSE", "CROP_SALE", 10, 12))) {
      mvc.perform(post("/api/v1/finances/entries").with(authentication(login(1))).with(csrf())
          .contentType("application/json").content(json.writeValueAsString(Map.of("farmId", 10, "operationId", UUID.randomUUID(), "entry", badEntry))))
        .andExpect(status().isBadRequest());
    }
    mvc.perform(get("/api/v1/finances").param("farmId", "20").param("month", "2026-11").with(authentication(login(3))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.totals.entryCount").value(0));
  }

  private void create(long userId, long farmId, Map<String, Object> entry) throws Exception {
    mvc.perform(post("/api/v1/finances/entries").with(authentication(login(userId))).with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(Map.of("farmId", farmId, "operationId", UUID.randomUUID(), "entry", entry))))
      .andExpect(status().isCreated());
  }

  private void saveBudget(long farmId, long userId, String month, double amount) throws Exception {
    mvc.perform(put("/api/v1/finances/budget").with(authentication(login(userId))).with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(Map.of("farmId", farmId, "month", month, "amount", amount))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(amount));
  }

  private Map<String, Object> entry(String date, String type, String category, double amount, long blockId) {
    return Map.of("entryDate", date, "type", type, "category", category, "amount", amount, "blockId", blockId,
      "description", "Movimiento de prueba");
  }

  private UsernamePasswordAuthenticationToken login(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User(id, "Usuario de prueba", "test@example.com"), null, List.of());
  }
}
