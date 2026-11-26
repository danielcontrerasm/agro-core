package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.events.controller.EventController;
import com.yourco.agro.events.controller.LegacyObservationController;
import com.yourco.agro.events.repo.FieldEventRepository;
import com.yourco.agro.events.repo.ObservationDetailRepository;
import com.yourco.agro.events.service.EventService;
import com.yourco.agro.events.service.LegacyObservationService;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.farm.repo.RowRepository;
import com.yourco.agro.persistence.JpaSql;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({LegacyObservationController.class, EventController.class})
@Import({SecurityConfig.class, FarmAccess.class, LegacyObservationService.class, EventService.class,
  LegacyObservationApiTest.DatabaseConfig.class})
@Transactional
class LegacyObservationApiTest {
  private static final String OBSERVATION = "/api/v1/events/14/legacy-observation";

  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class DatabaseConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database("auth-schema.sql", "db/migration/V2__users_and_memberships.sql",
        "db/migration/V6__phytosanitary_inspections.sql", "db/migration/V22__phytosanitary_catalog_and_inspection_area.sql",
        "legacy-observation-schema.sql", "db/migration/V35__legacy_observation_revisions.sql");
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;
  @MockBean FieldEventRepository events;
  @MockBean BlockRepository blocks;
  @MockBean RowRepository rows;
  @MockBean ObservationDetailRepository details;

  @BeforeEach
  void seed() {
    queries.execute("INSERT INTO farm VALUES (10, 'Finca QA'), (20, 'Otra finca QA')");
    queries.execute("INSERT INTO field VALUES (11, 10), (21, 20)");
    queries.execute("INSERT INTO block VALUES (12, 11, 10), (22, 21, 10)");
    queries.execute("INSERT INTO row_line VALUES (13, 12)");
    queries.execute("""
      INSERT INTO app_user(id, name, email, password_hash) VALUES
        (1, 'Operario QA', 'worker@example.com', 'hash'),
        (2, 'Supervisora QA', 'supervisor@example.com', 'hash'),
        (3, 'Administrador externo QA', 'external@example.com', 'hash')
      """);
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'WORKER'), (10, 2, 'SUPERVISOR'), (20, 3, 'ADMIN')");
    queries.execute("""
      INSERT INTO field_event(id, block_id, row_id, event_type, created_by_user_id, notes, occurred_at) VALUES
        (14, 12, 13, 'SCOUTING_OBSERVATION', 1, 'Notas originales', '2026-01-10T10:00:00Z'),
        (15, NULL, 13, 'SCOUTING_OBSERVATION', 1, 'Solo notas anteriores', '2026-01-10T11:00:00Z'),
        (16, 12, NULL, 'TREATMENT_APPLICATION', 1, 'Otro tipo', '2026-01-11T10:00:00Z')
      """);
    queries.execute("""
      INSERT INTO observation_detail (event_id, symptoms, severity, suspected_catalog_id, ai_diagnosis_json)
      VALUES (14, 'Manchas originales', 2, 77, '{"original":true}')
      """);
  }

  @Test
  void revisesTheObservationAndKeepsPriorValuesAndOriginalMetadata() throws Exception {
    mvc.perform(get(OBSERVATION).with(authentication(login(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.version").value(0))
      .andExpect(jsonPath("$.suspectedCatalogId").value(77))
      .andExpect(jsonPath("$.symptoms").value("Manchas originales"))
      .andExpect(jsonPath("$.history").isEmpty());
    edit(OBSERVATION, 2, editFields(0, 4, "sigatoka")).andExpect(status().isOk())
      .andExpect(jsonPath("$.version").value(1))
      .andExpect(jsonPath("$.problemCode").value("SIGATOKA"))
      .andExpect(jsonPath("$.history[0].version").value(1))
      .andExpect(jsonPath("$.history[0].editorName").value("Supervisora QA"))
      .andExpect(jsonPath("$.history[0].editedByUserId").value(2))
      .andExpect(jsonPath("$.history[0].editedAt").isString())
      .andExpect(jsonPath("$.history[0].reason").value("Corrección de captura"))
      .andExpect(jsonPath("$.history[0].before.notes").value("Notas originales"))
      .andExpect(jsonPath("$.history[0].before.severity").value(2))
      .andExpect(jsonPath("$.history[0].after.symptoms").value("Manchas revisadas"))
      .andExpect(jsonPath("$.history[0].after.severity").value(4));
    edit(OBSERVATION, 2, editFields(1, 3, "sigatoka")).andExpect(status().isOk())
      .andExpect(jsonPath("$.history.length()").value(2))
      .andExpect(jsonPath("$.history[0].before.severity").value(4))
      .andExpect(jsonPath("$.history[0].after.severity").value(3))
      .andExpect(jsonPath("$.history[1].before.severity").value(2));

    assertThat(queries.value("SELECT occurred_at FROM field_event WHERE id=14", Instant.class))
      .isEqualTo(Instant.parse("2026-01-10T10:00:00Z"));
    assertThat(queries.value("SELECT row_id FROM field_event WHERE id=14", Long.class)).isEqualTo(13);
    assertThat(queries.value("SELECT created_by_user_id FROM field_event WHERE id=14", Long.class)).isEqualTo(1);
    assertThat(queries.value("SELECT ai_diagnosis_json FROM observation_detail WHERE event_id=14", String.class))
      .isEqualTo("{\"original\":true}");
  }

  @Test
  void addsObservationDataToAnOldEventThatOnlyHadNotes() throws Exception {
    String target = "/api/v1/events/15/legacy-observation";
    mvc.perform(get(target).with(authentication(login(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.symptoms").doesNotExist()).andExpect(jsonPath("$.notes").value("Solo notas anteriores"));
    edit(target, 2, editFields(0, 1, "WEEVILS")).andExpect(status().isOk())
      .andExpect(jsonPath("$.severity").value(1)).andExpect(jsonPath("$.problemCode").value("WEEVILS"))
      .andExpect(jsonPath("$.history[0].before.symptoms").doesNotExist());
    assertThat(queries.value("SELECT symptoms FROM observation_detail WHERE event_id=15", String.class)).isEqualTo("Manchas revisadas");
  }

  @Test
  void enforcesCatalogVersionPermissionsAndPreventsDeletingTheAudit() throws Exception {
    mvc.perform(get(OBSERVATION)).andExpect(status().isUnauthorized());
    mvc.perform(get(OBSERVATION).with(authentication(login(3)))).andExpect(status().isForbidden());
    edit(OBSERVATION, 1, editFields(0, 4, "SIGATOKA")).andExpect(status().isForbidden());
    mvc.perform(patch(OBSERVATION).with(authentication(login(2))).contentType("application/json")
      .content(json.writeValueAsString(editFields(0, 4, "SIGATOKA")))).andExpect(status().isForbidden());
    edit("/api/v1/events/16/legacy-observation", 2, editFields(0, 4, "SIGATOKA")).andExpect(status().isNotFound());
    edit(OBSERVATION, 2, editFields(0, 6, "SIGATOKA")).andExpect(status().isBadRequest());
    queries.execute("UPDATE phytosanitary_problem SET active=FALSE WHERE code='SIGATOKA'");
    edit(OBSERVATION, 2, editFields(0, 4, "SIGATOKA")).andExpect(status().isBadRequest());
    edit(OBSERVATION, 2, Map.of("version", 0, "reason", " ")).andExpect(status().isBadRequest());
    edit(OBSERVATION, 2, editFields(0, 4, "WEEVILS")).andExpect(status().isOk());
    edit(OBSERVATION, 2, editFields(0, 3, "WEEVILS")).andExpect(status().isConflict());
    mvc.perform(delete("/api/v1/events/14").with(authentication(login(2))).with(csrf()))
      .andExpect(status().isConflict());
    verifyNoInteractions(events);
    mvc.perform(get(OBSERVATION).with(authentication(login(1)))).andExpect(status().isOk())
      .andExpect(jsonPath("$.history.length()").value(1)).andExpect(jsonPath("$.severity").value(4));
  }

  private ResultActions edit(String path, long user, Map<String, Object> body) throws Exception {
    return mvc.perform(patch(path).with(authentication(login(user))).with(csrf())
      .contentType("application/json").content(json.writeValueAsString(body)));
  }

  private Map<String, Object> editFields(long version, int severity, String problemCode) {
    return Map.of("version", version, "severity", severity, "problemCode", problemCode,
      "reason", "Corrección de captura", "notes", "Notas revisadas", "symptoms", "Manchas revisadas");
  }

  private UsernamePasswordAuthenticationToken login(long userId) {
    return UsernamePasswordAuthenticationToken.authenticated(
      new AuthDtos.User(userId, "Usuario QA", "user@example.com"), null, List.of());
  }
}
