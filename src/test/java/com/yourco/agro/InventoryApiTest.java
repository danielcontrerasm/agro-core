package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.inventory.InventoryController;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InventoryController.class)
@Import({SecurityConfig.class, FarmAccess.class, InventoryService.class, InventoryApiTest.DatabaseConfig.class})
class InventoryApiTest {
  private static final String API = "/api/v1/inventory";

  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class DatabaseConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database("auth-schema.sql", "db/migration/V2__users_and_memberships.sql", "db/migration/V25__inventory.sql");
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;

  @BeforeEach
  void seed() {
    queries.execute("DELETE FROM farm");
    queries.execute("DELETE FROM app_user");
    queries.execute("INSERT INTO farm VALUES (10, 'North'), (20, 'South')");
    queries.execute("INSERT INTO app_user (id, name, email, password_hash) VALUES (1, 'Manager', 'manager@example.com', 'hash'), (2, 'Worker', 'worker@example.com', 'hash')");
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'SUPERVISOR'), (20, 1, 'ADMIN'), (10, 2, 'WORKER')");
  }

  @Test
  void computesAvailableAndPhysicalBalancesFromFarmLotsAndEnforcesAccess() throws Exception {
    long productId = createProduct();
    long expiredLotId = createLot(productId, "old", LocalDate.now(ZoneOffset.UTC).minusDays(1));
    long availableLotId = createLot(productId, "fresh", LocalDate.now(ZoneOffset.UTC).plusDays(10));
    UUID retryId = UUID.randomUUID();
    long entryId = id(write("/movements", 1, movement(10, availableLotId, retryId, "IN", "2.250"))
      .andExpect(status().isCreated()).andExpect(jsonPath("$.balanceAfter").value(2.25)));
    write("/movements", 1, movement(10, availableLotId, retryId, "IN", "2.25"))
      .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(entryId));
    write("/movements", 1, movement(10, availableLotId, retryId, "IN", "2.500"))
      .andExpect(status().isConflict());
    write("/movements", 1, movement(10, expiredLotId, UUID.randomUUID(), "IN", "1.750"))
      .andExpect(status().isCreated());

    mvc.perform(get(API).param("farmId", "10").with(authentication(user(2))))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.products[0].available").value(2.25))
      .andExpect(jsonPath("$.products[0].balance").value(4))
      .andExpect(jsonPath("$.products[0].lowStock").value(true))
      .andExpect(jsonPath("$.lots[0].status").value("EXPIRED"))
      .andExpect(jsonPath("$.lots[1].status").value("EXPIRING"))
      .andExpect(jsonPath("$.movements.entries.length()").value(2));

    write("/movements", 2, movement(10, availableLotId, UUID.randomUUID(), "OUT", "1"))
      .andExpect(status().isForbidden());
    write("/movements", 1, movement(20, availableLotId, UUID.randomUUID(), "OUT", "1"))
      .andExpect(status().isNotFound());
    mvc.perform(get(API).param("farmId", "20").with(authentication(user(2))))
      .andExpect(status().isForbidden());
  }

  @Test
  void concurrentWithdrawalsNeverExceedTheLotBalance() throws Exception {
    long lotId = createLot(createProduct(), "fresh", null);
    write("/movements", 1, movement(10, lotId, UUID.randomUUID(), "IN", "5")).andExpect(status().isCreated());
    var executor = Executors.newFixedThreadPool(2);
    var start = new CountDownLatch(1);
    try {
      var first = executor.submit(() -> {
        start.await();
        return write("/movements", 1, movement(10, lotId, UUID.randomUUID(), "OUT", "4")).andReturn().getResponse().getStatus();
      });
      var second = executor.submit(() -> {
        start.await();
        return write("/movements", 1, movement(10, lotId, UUID.randomUUID(), "OUT", "4")).andReturn().getResponse().getStatus();
      });
      start.countDown();
      assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201, 409);
    } finally {
      executor.shutdownNow();
    }
    mvc.perform(get(API).param("farmId", "10").with(authentication(user(1))))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.products[0].available").value(1))
      .andExpect(jsonPath("$.lots[0].balance").value(1))
      .andExpect(jsonPath("$.movements.entries.length()").value(2));
  }

  private long createProduct() throws Exception {
    return id(write("/products", 1, Map.of("farmId", 10, "code", "npk", "name", "NPK", "category", "Fertilizantes", "unit", "kg", "minimum", "3"))
      .andExpect(status().isCreated()).andExpect(jsonPath("$.code").value("NPK")));
  }

  private long createLot(long productId, String code, LocalDate expiresOn) throws Exception {
    Map<String, Object> request = new java.util.HashMap<>(Map.of("farmId", 10, "productId", productId, "code", code));
    if (expiresOn != null) request.put("expiresOn", expiresOn);
    return id(write("/lots", 1, request).andExpect(status().isCreated()));
  }

  private ResultActions write(String path, long userId, Map<String, Object> request) throws Exception {
    return mvc.perform(post(API + path).with(authentication(user(userId))).with(csrf())
      .contentType("application/json").content(json.writeValueAsString(request)));
  }

  private long id(ResultActions response) throws Exception {
    return json.readTree(response.andReturn().getResponse().getContentAsString()).get("id").asLong();
  }

  private static Map<String, Object> movement(long farmId, long lotId, UUID requestId, String direction, String quantity) {
    return Map.of("farmId", farmId, "lotId", lotId, "requestId", requestId, "direction", direction, "quantity", quantity);
  }

  private static UsernamePasswordAuthenticationToken user(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User(id, "User " + id, "test@example.com"), null, List.of());
  }
}
