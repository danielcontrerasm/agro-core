package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.persistence.JpaSql;
import com.yourco.agro.workforce.WorkforceController;
import com.yourco.agro.workforce.WorkforceService;
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

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WorkforceController.class)
@Import({SecurityConfig.class, FarmAccess.class, WorkforceService.class, WorkforceApiTest.DatabaseConfig.class})
class WorkforceApiTest {
  private static final String WORKFORCE = "/api/v1/workforce";
  private static final String DATE = "2026-11-25";

  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class DatabaseConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database("auth-schema.sql", "db/migration/V2__users_and_memberships.sql", "db/migration/V27__workforce.sql");
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;

  @BeforeEach
  void seed() {
    queries.execute("DELETE FROM workforce_attendance");
    queries.execute("DELETE FROM workforce_crew_member");
    queries.execute("DELETE FROM workforce_crew");
    queries.execute("DELETE FROM farm_membership");
    queries.execute("DELETE FROM app_user");
    queries.execute("DELETE FROM farm");
    queries.execute("INSERT INTO farm VALUES (10, 'Norte'), (20, 'Sur')");
    queries.execute("""
      INSERT INTO app_user(id, name, email, password_hash) VALUES
        (1, 'Ana', 'ana@example.com', 'hash'), (2, 'Beatriz', 'beatriz@example.com', 'hash'),
        (3, 'Carlos', 'carlos@example.com', 'hash'), (4, 'Diego', 'diego@example.com', 'hash')
      """);
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'WORKER'), (10, 2, 'ADMIN'), (10, 3, 'SUPERVISOR'), (20, 4, 'ADMIN')");
  }

  @Test
  void assignsCrewsOnlyToFarmMembersAndShowsWorkersTheirOwnCrew() throws Exception {
    long north = id(write(post(WORKFORCE + "/crews"), 2, Map.of("farmId", 10, "name", "  Caminantes  ", "memberIds", List.of(1, 3)))
      .andExpect(status().isCreated()).andExpect(jsonPath("name").value("Caminantes")));
    long empty = id(write(post(WORKFORCE + "/crews"), 3, Map.of("farmId", 10, "name", "Sembradores", "memberIds", List.of()))
      .andExpect(status().isCreated()));

    read(1, 10, DATE).andExpect(status().isOk()).andExpect(jsonPath("crews.length()").value(1))
      .andExpect(jsonPath("crews[0].memberIds.length()").value(1)).andExpect(jsonPath("crews[0].memberIds[0]").value(1));
    read(2, 10, DATE).andExpect(status().isOk()).andExpect(jsonPath("crews.length()").value(2));
    read(4, 10, DATE).andExpect(status().isForbidden());

    write(post(WORKFORCE + "/crews"), 2, Map.of("farmId", 10, "name", "CAMINANTES", "memberIds", List.of()))
      .andExpect(status().isConflict());
    write(patch(WORKFORCE + "/crews/" + empty), 2, Map.of("name", "Sembradores", "version", 0, "memberIds", List.of(4)))
      .andExpect(status().isBadRequest());
    write(patch(WORKFORCE + "/crews/" + empty), 2, Map.of("name", "Sembradores", "version", 0, "memberIds", List.of(1)))
      .andExpect(status().isConflict());
    write(patch(WORKFORCE + "/crews/" + north), 4, Map.of("name", "Caminantes", "version", 0, "memberIds", List.of()))
      .andExpect(status().isForbidden());
    write(patch(WORKFORCE + "/crews/" + north), 3, Map.of("name", "Caminantes", "version", 0, "memberIds", List.of(3)))
      .andExpect(status().isOk()).andExpect(jsonPath("version").value(1));
    write(patch(WORKFORCE + "/crews/" + empty), 2, Map.of("name", "Sembradores", "version", 0, "memberIds", List.of(1)))
      .andExpect(status().isOk()).andExpect(jsonPath("memberIds[0]").value(1));
    write(patch(WORKFORCE + "/crews/" + north), 2, Map.of("name", "Viejo", "version", 0, "memberIds", List.of()))
      .andExpect(status().isConflict());
  }

  @Test
  void recordsDailyAttendanceAndEnforcesPermissionsAndVersions() throws Exception {
    var present = Map.of("farmId", 10, "userId", 1, "date", DATE, "status", "PRESENT", "hours", 7.25);
    write(post(WORKFORCE + "/attendance"), 1, present).andExpect(status().isForbidden());
    long id = id(write(post(WORKFORCE + "/attendance"), 3, present).andExpect(status().isCreated())
      .andExpect(jsonPath("hours").value(7.25)).andExpect(jsonPath("date").value(DATE)));
    write(post(WORKFORCE + "/attendance"), 2, present).andExpect(status().isConflict());
    write(post(WORKFORCE + "/attendance"), 2, Map.of("farmId", 10, "userId", 4, "date", DATE, "status", "PRESENT", "hours", 1))
      .andExpect(status().isBadRequest());
    write(post(WORKFORCE + "/attendance"), 2, Map.of("farmId", 10, "userId", 3, "date", DATE, "status", "EXCUSED", "hours", 2))
      .andExpect(status().isBadRequest());
    write(post(WORKFORCE + "/attendance"), 2, Map.of("farmId", 10, "userId", 3, "date", DATE, "status", "ABSENT", "hours", 0))
      .andExpect(status().isCreated());

    var correction = Map.of("version", 0, "status", "EXCUSED", "hours", 0, "notes", "Permiso registrado");
    write(patch(WORKFORCE + "/attendance/" + id), 4, correction).andExpect(status().isForbidden());
    write(patch(WORKFORCE + "/attendance/" + id), 2, correction).andExpect(status().isOk())
      .andExpect(jsonPath("version").value(1)).andExpect(jsonPath("notes").value("Permiso registrado"));
    write(patch(WORKFORCE + "/attendance/" + id), 2, correction).andExpect(status().isConflict());
    read(1, 10, DATE).andExpect(status().isOk()).andExpect(jsonPath("attendance.length()").value(1))
      .andExpect(jsonPath("attendance[0].status").value("EXCUSED")).andExpect(jsonPath("attendance[0].userId").value(1));
    read(2, 10, DATE).andExpect(jsonPath("attendance.length()").value(2));
    read(2, 10, "2026-11-24").andExpect(jsonPath("attendance.length()").value(0));
  }

  private ResultActions write(MockHttpServletRequestBuilder request, long userId, Map<String, ?> body) throws Exception {
    return mvc.perform(request.with(authentication(login(userId))).with(csrf()).contentType("application/json")
      .content(json.writeValueAsString(body)));
  }

  private ResultActions read(long userId, long farmId, String date) throws Exception {
    return mvc.perform(get(WORKFORCE).with(authentication(login(userId))).param("farmId", Long.toString(farmId)).param("date", date));
  }

  private long id(ResultActions result) throws Exception {
    return json.readTree(result.andReturn().getResponse().getContentAsString()).get("id").asLong();
  }

  private UsernamePasswordAuthenticationToken login(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(new AuthDtos.User(id, "User", "user@example.com"), null, List.of());
  }
}
