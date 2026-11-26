package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.persistence.JpaSql;
import com.yourco.agro.preventive.PreventiveMeasureController;
import com.yourco.agro.preventive.PreventiveMeasureService;
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

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PreventiveMeasureController.class)
@Import({SecurityConfig.class, FarmAccess.class, PreventiveMeasureService.class, PreventiveMeasureApiTest.DatabaseConfig.class})
class PreventiveMeasureApiTest {
  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class DatabaseConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database(
        "auth-schema.sql",
        "db/migration/V2__users_and_memberships.sql",
        "preventive-schema.sql",
        "db/migration/V16__preventive_measure_workflow.sql"
      );
    }

  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JpaSql queries;

  private UsernamePasswordAuthenticationToken login(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(
      new AuthDtos.User(id, id == 1 ? "Worker" : "Manager", id == 1 ? "worker@example.com" : "manager@example.com"),
      null, List.of());
  }

  @BeforeEach
  void seed() {
    queries.execute("DELETE FROM preventive_measure_evidence");
    queries.execute("DELETE FROM preventive_measure_assignment");
    queries.execute("DELETE FROM preventive_measure_template");
    queries.execute("DELETE FROM farm_membership");
    queries.execute("DELETE FROM app_user");
    queries.execute("DELETE FROM block");
    queries.execute("DELETE FROM field");
    queries.execute("DELETE FROM farm");
    queries.execute("INSERT INTO farm VALUES (10, 'North'), (20, 'South')");
    queries.execute("INSERT INTO field VALUES (11, 10), (21, 20)");
    queries.execute("INSERT INTO block(id, field_id, code) VALUES (12, 11, 'A'), (22, 21, 'B')");
    queries.execute("INSERT INTO app_user(id, name, email, password_hash) VALUES (1, 'Worker', 'worker@example.com', 'hash'), (2, 'Manager', 'manager@example.com', 'hash')");
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'WORKER'), (10, 2, 'ADMIN'), (20, 2, 'ADMIN')");
  }

  @Test
  void templatesAssignmentsCompletionAndEvidenceRespectAccess() throws Exception {
    var template = mvc.perform(post("/api/v1/preventive-measures").with(authentication(login(2))).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(Map.of(
          "farmId", 10, "code", "MONITOR-LEAF", "name", "Monitoreo semanal de hojas",
          "category", "MONITORING", "instructions", "Revisar diez plantas por surco y registrar síntomas."))))
      .andExpect(status().isCreated())
      .andExpect(jsonPath("code").value("monitor-leaf"))
      .andExpect(jsonPath("active").value(true))
      .andReturn();
    long templateId = json.readTree(template.getResponse().getContentAsString()).get("id").asLong();

    mvc.perform(get("/api/v1/preventive-measures").param("farmId", "10").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    var assignment = mvc.perform(post("/api/v1/preventive-assignments").with(authentication(login(1))).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(Map.of(
          "templateId", templateId, "blockId", 12, "scheduledFor", "2026-10-25", "assignedToUserId", 1))))
      .andExpect(status().isCreated())
      .andExpect(jsonPath("blockCode").value("A"))
      .andExpect(jsonPath("status").value("PLANNED"))
      .andReturn();
    long assignmentId = json.readTree(assignment.getResponse().getContentAsString()).get("id").asLong();

    mvc.perform(patch("/api/v1/preventive-assignments/" + assignmentId).with(authentication(login(1))).with(csrf())
        .contentType("application/json").content("{\"status\":\"COMPLETED\",\"completionNotes\":\"Sin presencia de plagas.\",\"version\":0}"))
      .andExpect(status().isOk()).andExpect(jsonPath("status").value("COMPLETED"))
      .andExpect(jsonPath("completedByUserId").value(1));
    mvc.perform(patch("/api/v1/preventive-assignments/" + assignmentId).with(authentication(login(1))).with(csrf())
        .contentType("application/json").content("{\"status\":\"COMPLETED\",\"completionNotes\":\"Vieja versión.\",\"version\":0}"))
      .andExpect(status().isConflict());
    mvc.perform(post("/api/v1/preventive-assignments/" + assignmentId + "/evidence").with(authentication(login(1))).with(csrf())
        .contentType("application/json").content("{\"kind\":\"IMAGE\",\"s3Key\":\"preventive/monitoring.jpg\",\"contentType\":\"image/jpeg\"}"))
      .andExpect(status().isOk()).andExpect(jsonPath("assignmentId").value(assignmentId));
    mvc.perform(get("/api/v1/preventive-assignments").param("farmId", "10").param("status", "COMPLETED").with(authentication(login(1))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  void validatesFarmOwnershipAndCompletionNotes() throws Exception {
    var template = mvc.perform(post("/api/v1/preventive-measures").with(authentication(login(2))).with(csrf())
        .contentType("application/json").content("{\"farmId\":10,\"code\":\"SANITATION\",\"name\":\"Retiro de material afectado\",\"category\":\"SANITATION\",\"instructions\":\"Retirar y disponer el material según protocolo.\"}"))
      .andExpect(status().isCreated()).andReturn();
    long templateId = json.readTree(template.getResponse().getContentAsString()).get("id").asLong();
    mvc.perform(post("/api/v1/preventive-assignments").with(authentication(login(2))).with(csrf())
        .contentType("application/json").content("{\"templateId\":" + templateId + ",\"blockId\":22,\"scheduledFor\":\"2026-10-25\"}"))
      .andExpect(status().isBadRequest());
    var assignment = mvc.perform(post("/api/v1/preventive-assignments").with(authentication(login(1))).with(csrf())
        .contentType("application/json").content("{\"templateId\":" + templateId + ",\"blockId\":12,\"scheduledFor\":\"2026-10-25\"}"))
      .andExpect(status().isCreated()).andReturn();
    long assignmentId = json.readTree(assignment.getResponse().getContentAsString()).get("id").asLong();
    mvc.perform(patch("/api/v1/preventive-assignments/" + assignmentId).with(authentication(login(1))).with(csrf())
        .contentType("application/json").content("{\"status\":\"COMPLETED\",\"completionNotes\":\" \",\"version\":0}"))
      .andExpect(status().isBadRequest());
    mvc.perform(post("/api/v1/preventive-measures").with(authentication(login(1))).with(csrf())
        .contentType("application/json").content("{\"farmId\":10,\"code\":\"WORKER\",\"name\":\"No autorizado\",\"category\":\"OTHER\",\"instructions\":\"No\"}"))
      .andExpect(status().isForbidden());
  }
}
