package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.*;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.events.controller.EventController;
import com.yourco.agro.events.controller.MapLayerController;
import com.yourco.agro.events.repo.FieldEventRepository;
import com.yourco.agro.events.repo.ObservationDetailRepository;
import com.yourco.agro.events.service.EventService;
import com.yourco.agro.farm.controller.*;
import com.yourco.agro.farm.dto.FarmDtos;
import com.yourco.agro.farm.entity.*;
import com.yourco.agro.farm.repo.*;
import com.yourco.agro.farm.service.*;
import com.yourco.agro.media.controller.MediaController;
import com.yourco.agro.media.repo.MediaAssetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {AuthController.class, MembershipController.class, FarmController.class,
  FieldController.class, BlockController.class, RowController.class, EventController.class,
  MapLayerController.class, MediaController.class})
@Import({SecurityConfig.class, UserService.class, FarmAccess.class, EventService.class,
  AuthIntegrationTest.DatabaseConfig.class})
class AuthIntegrationTest {
  @TestConfiguration
  static class DatabaseConfig {
    @Bean
    DataSource dataSource() {
      return new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2)
        .addScript("auth-schema.sql")
        .addScript("db/migration/V2__users_and_memberships.sql").build();
    }

    @Bean
    JdbcTemplate jdbcTemplate(DataSource dataSource) { return new JdbcTemplate(dataSource); }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;
  @Autowired PasswordEncoder passwords;
  @Autowired UserService users;
  @Autowired FarmAccess access;
  @MockBean FarmRepository farmRepo;
  @MockBean FieldRepository fieldRepo;
  @MockBean BlockRepository blockRepo;
  @MockBean RowRepository rowRepo;
  @MockBean FieldEventRepository eventRepo;
  @MockBean ObservationDetailRepository observationRepo;
  @MockBean MediaAssetRepository mediaRepo;
  @MockBean FarmService farmService;
  @MockBean FieldService fieldService;
  @MockBean BlockService blockService;
  @MockBean RowService rowService;

  @BeforeEach
  void seed() {
    jdbc.update("DELETE FROM farm_membership");
    jdbc.update("DELETE FROM app_user");
    jdbc.update("DELETE FROM field_event");
    jdbc.update("DELETE FROM row_line");
    jdbc.update("DELETE FROM block");
    jdbc.update("DELETE FROM field");
    jdbc.update("DELETE FROM farm");
    jdbc.update("INSERT INTO farm VALUES (10, 'North'), (20, 'South')");
    jdbc.update("INSERT INTO field VALUES (11, 10), (21, 20)");
    jdbc.update("INSERT INTO block VALUES (12, 11), (22, 21)");
    jdbc.update("INSERT INTO row_line VALUES (13, 12), (23, 22)");
    jdbc.update("INSERT INTO field_event VALUES (14, 12, NULL), (24, NULL, 23)");
    users.register(new AuthDtos.RegisterRequest("Worker", "worker@example.com", "worker-password"));
    users.register(new AuthDtos.RegisterRequest("Admin", "admin@example.com", "admin-password"));
    jdbc.update("INSERT INTO farm_membership SELECT 10, id, 'WORKER' FROM app_user WHERE email = 'worker@example.com'");
    jdbc.update("INSERT INTO farm_membership SELECT 10, id, 'ADMIN' FROM app_user WHERE email = 'admin@example.com'");
  }

  @Test
  void registerNormalizesEmailAndNeverReturnsOrStoresPlaintextPassword() throws Exception {
    mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType("application/json")
        .content("""
          {"name":"New Worker","email":"New@Example.com","password":"long-password-123"}
          """))
      .andExpect(status().isCreated()).andExpect(jsonPath("email").value("new@example.com"))
      .andExpect(jsonPath("password").doesNotExist()).andExpect(jsonPath("passwordHash").doesNotExist());
    String hash = jdbc.queryForObject("SELECT password_hash FROM app_user WHERE email = 'new@example.com'", String.class);
    assertThat(hash).isNotEqualTo("long-password-123");
    assertThat(passwords.matches("long-password-123", hash)).isTrue();
    mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType("application/json")
        .content("""
          {"name":"Duplicate","email":"NEW@example.com","password":"long-password-123"}
          """))
      .andExpect(status().isConflict());
  }

  @Test
  void loginReturnsFarmRoleAndLogoutRevokesSession() throws Exception {
    MockHttpSession session = login("worker");
    mvc.perform(get("/api/v1/auth/me").session(session))
      .andExpect(status().isOk()).andExpect(jsonPath("memberships[0].farmId").value(10))
      .andExpect(jsonPath("memberships[0].role").value("WORKER"));
    mvc.perform(post("/api/v1/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
    assertThat(session.isInvalid()).isTrue();
    mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void invalidLoginAndMissingCsrfAreRejected() throws Exception {
    mvc.perform(post("/api/v1/auth/login").with(csrf()).contentType("application/json")
        .content("{\"email\":\"worker@example.com\",\"password\":\"wrong-password\"}"))
      .andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/auth/login").contentType("application/json")
        .content("{\"email\":\"worker@example.com\",\"password\":\"worker-password\"}"))
      .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk())
      .andExpect(jsonPath("headerName").value("X-CSRF-TOKEN")).andExpect(jsonPath("token").isNotEmpty());
  }

  @Test
  void loginRotatesSessionIdAndCsrfToken() throws Exception {
    var initial = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
    var session = (MockHttpSession) initial.getRequest().getSession(false);
    String oldId = session.getId();
    String token = json.readTree(initial.getResponse().getContentAsString()).get("token").asText();
    mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", token)
        .contentType("application/json")
        .content("{\"email\":\"worker@example.com\",\"password\":\"worker-password\"}"))
      .andExpect(status().isOk());
    assertThat(session.getId()).isNotEqualTo(oldId);
    mvc.perform(post("/api/v1/auth/logout").session(session).header("X-CSRF-TOKEN", token))
      .andExpect(status().isForbidden());
  }

  @Test
  void workerCannotManageFarmOrAccessAnotherFarmsResources() throws Exception {
    var session = login("worker");
    for (String path : List.of("/farms/20", "/fields/21", "/blocks/22", "/rows/23", "/events/24",
        "/fields?farmId=20", "/blocks?fieldId=21", "/rows?blockId=22", "/events?farmId=20",
        "/map/rows/disease?farmId=20", "/media?eventId=24", "/farms/10/members")) {
      mvc.perform(get("/api/v1" + path).session(session)).andExpect(status().isForbidden());
    }
    mvc.perform(delete("/api/v1/farms/10").session(session).with(csrf())).andExpect(status().isForbidden());
    mvc.perform(post("/api/v1/fields").session(session).with(csrf()).contentType("application/json")
        .content("{\"farmId\":10,\"name\":\"Field\",\"polygon\":{\"coordinates\":[]}}"))
      .andExpect(status().isForbidden());
    verifyNoInteractions(fieldService);
  }

  @Test
  void farmAndFieldListsOnlyReturnMembershipData() throws Exception {
    var session = login("worker");
    Farm farm = new Farm(); farm.setId(10L); farm.setName("North");
    Farm other = new Farm(); other.setId(20L);
    Field field = new Field(); field.setId(11L); field.setFarm(farm);
    Field foreignField = new Field(); foreignField.setId(21L); foreignField.setFarm(other);
    when(farmRepo.findAllById(List.of(10L))).thenReturn(List.of(farm));
    when(fieldRepo.findAll()).thenReturn(List.of(field, foreignField));
    mvc.perform(get("/api/v1/farms").session(session)).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(10));
    mvc.perform(get("/api/v1/fields").session(session)).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(11));
  }

  @Test
  void onlyAdminCanAssignMembershipsAndCannotDemoteSelf() throws Exception {
    mvc.perform(put("/api/v1/farms/10/members").session(login("worker")).with(csrf())
        .contentType("application/json").content("{\"email\":\"worker@example.com\",\"role\":\"ADMIN\"}"))
      .andExpect(status().isForbidden());
    mvc.perform(put("/api/v1/farms/10/members").session(login("admin")).with(csrf())
        .contentType("application/json").content("{\"email\":\"admin@example.com\",\"role\":\"WORKER\"}"))
      .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/farms/10/members").session(login("admin"))).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(2));
  }

  @Test
  void farmCreatorReceivesAdminMembership() {
    var user = users.findByEmail("worker@example.com");
    SecurityContextHolder.getContext().setAuthentication(
      org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
    try {
      Farm farm = new Farm(); farm.setId(30L);
      when(farmRepo.saveAndFlush(any(Farm.class))).thenAnswer(invocation -> {
        jdbc.update("INSERT INTO farm VALUES (30, 'New Farm')");
        return farm;
      });
      FarmDtos.CreateFarmRequest request = new FarmDtos.CreateFarmRequest(); request.name = "New Farm";
      new FarmService(farmRepo, access, jdbc).create(request);
      assertThat(users.profile(user).memberships()).anyMatch(membership ->
        membership.farmId().equals(30L) && membership.role() == AuthDtos.Role.ADMIN);
    } finally {
      SecurityContextHolder.clearContext();
    }
  }

  @Test
  void eventCreatorComesFromLoginAndForeignTargetsAreRejected() throws Exception {
    Block block = new Block(); block.setId(12L);
    when(blockRepo.findById(12L)).thenReturn(java.util.Optional.of(block));
    when(eventRepo.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    mvc.perform(post("/api/v1/events").session(login("worker")).with(csrf()).contentType("application/json")
        .content("""
          {"eventType":"IRRIGATION_EVENT","occurredAt":"2026-10-16T12:00:00Z","blockId":12,"createdByUserId":999}
          """))
      .andExpect(status().isOk()).andExpect(jsonPath("createdByUserId")
        .value(users.findByEmail("worker@example.com").id()));
    mvc.perform(post("/api/v1/events").session(login("worker")).with(csrf()).contentType("application/json")
        .content("""
          {"eventType":"IRRIGATION_EVENT","occurredAt":"2026-10-16T12:00:00Z","blockId":22}
          """))
      .andExpect(status().isForbidden());
  }

  private MockHttpSession login(String name) throws Exception {
    var result = mvc.perform(post("/api/v1/auth/login").with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(new AuthDtos.LoginRequest(name + "@example.com", name + "-password"))))
      .andExpect(status().isOk()).andReturn();
    return (MockHttpSession) result.getRequest().getSession(false);
  }
}
