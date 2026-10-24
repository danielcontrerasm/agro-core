package com.yourco.agro;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TaskApiTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;
  @Autowired UserService users;
  AuthDtos.User owner;
  AuthDtos.User worker;
  AuthDtos.User otherWorker;
  AuthDtos.User outsider;
  Long farmId;
  Long fieldId;
  Long blockId;
  Long foreignFieldId;

  @BeforeEach
  void seed() {
    owner = user("Owner"); worker = user("Worker"); otherWorker = user("Worker"); outsider = user("Outsider");
    farmId = jdbc.queryForObject("INSERT INTO farm(name) VALUES ('Task test') RETURNING id", Long.class);
    Long foreignFarmId = jdbc.queryForObject("INSERT INTO farm(name) VALUES ('Foreign test') RETURNING id", Long.class);
    for (var member : List.of(owner, worker, otherWorker)) {
      jdbc.update("INSERT INTO farm_membership(farm_id,user_id,role) VALUES (?,?,?)", farmId, member.id(), member == owner ? "ADMIN" : "WORKER");
    }
    fieldId = field(farmId); foreignFieldId = field(foreignFarmId);
    blockId = jdbc.queryForObject("INSERT INTO block(field_id,code,geom) SELECT id,'A',geom FROM field WHERE id=? RETURNING id", Long.class, fieldId);
  }

  @Test
  void fieldAndBlockTasksPersistAndWorkersOnlySeeTheirOwnAssignments() throws Exception {
    String id = created(payload(), owner).get("id").asText();
    var blockPayload = payload(); blockPayload.remove("fieldId"); blockPayload.put("blockId", blockId);
    blockPayload.put("assigneeId", otherWorker.id()); created(blockPayload, owner);
    mvc.perform(get("/api/v1/tasks").with(authentication(login(owner))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
    mvc.perform(get("/api/v1/tasks").with(authentication(login(worker))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].id").value(id)).andExpect(jsonPath("$[0].assigneeId").value(worker.id()))
      .andExpect(jsonPath("$[0].fieldId").value(fieldId));
    mvc.perform(get("/api/v1/tasks").with(authentication(login(outsider))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    mvc.perform(get("/api/v1/tasks").param("farmId", farmId.toString()).with(authentication(login(outsider))))
      .andExpect(status().isForbidden());
    assertThat(jdbc.queryForObject("SELECT count(*) FROM farm_task WHERE farm_id=?", Integer.class, farmId)).isEqualTo(2);
  }

  @Test
  void workflowRequiresNotesAndManagerApprovalAndRejectsStaleUpdates() throws Exception {
    String id = created(payload(), owner).get("id").asText();
    update(id, worker, "completed", 0, "").andExpect(status().isBadRequest());
    update(id, worker, "blocked", 0, " ").andExpect(status().isBadRequest());
    update(id, worker, "blocked", 0, "Acceso inundado").andExpect(status().isOk())
      .andExpect(jsonPath("notes").value("Acceso inundado"));
    update(id, worker, "progress", 0, "").andExpect(status().isConflict());
    update(id, otherWorker, "progress", 1, "").andExpect(status().isForbidden());
    update(id, outsider, "progress", 1, "").andExpect(status().isForbidden());
    update(id, worker, "progress", 1, "Acceso habilitado").andExpect(status().isOk());
    update(id, worker, "review", 2, "Inspección terminada").andExpect(status().isOk());
    update(id, worker, "completed", 3, "").andExpect(status().isForbidden());
    update(id, worker, "progress", 3, "").andExpect(status().isForbidden());
    update(id, owner, "progress", 3, "Revisar el lindero norte").andExpect(status().isOk());
    update(id, worker, "review", 4, "Lindero revisado").andExpect(status().isOk());
    update(id, owner, "completed", 5, "Aprobado").andExpect(status().isOk()).andExpect(jsonPath("version").value(6));
    update(id, owner, "progress", 6, "").andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("SELECT status FROM farm_task WHERE id=?", String.class, Long.valueOf(id))).isEqualTo("completed");
  }

  @Test
  void creationEnforcesMembershipLocationValidationAndCsrf() throws Exception {
    create(payload(), worker).andExpect(status().isForbidden());
    create(payload(), outsider).andExpect(status().isForbidden());
    var invalid = payload(); invalid.put("fieldId", foreignFieldId);
    create(invalid, owner).andExpect(status().isBadRequest());
    invalid = payload(); invalid.put("assigneeId", outsider.id());
    create(invalid, owner).andExpect(status().isBadRequest());
    invalid = payload(); invalid.put("blockId", blockId);
    create(invalid, owner).andExpect(status().isBadRequest());
    invalid = payload(); invalid.remove("fieldId");
    create(invalid, owner).andExpect(status().isBadRequest());
    invalid = payload(); invalid.put("title", " ");
    create(invalid, owner).andExpect(status().isBadRequest());
    invalid = payload(); invalid.put("activity", "unsupported");
    create(invalid, owner).andExpect(status().isBadRequest());
    mvc.perform(post("/api/v1/tasks").with(authentication(login(owner))).contentType("application/json").content(json.writeValueAsString(payload())))
      .andExpect(status().isForbidden());
    String id = created(payload(), owner).get("id").asText();
    mvc.perform(patch("/api/v1/tasks/" + id).with(authentication(login(worker))).contentType("application/json")
        .content("{\"status\":\"progress\",\"version\":0}"))
      .andExpect(status().isForbidden());
  }

  private AuthDtos.User user(String name) { return users.register(new AuthDtos.RegisterRequest(name, UUID.randomUUID() + "@example.com", "test-password-123")); }
  private Long field(Long farm) {
    return jdbc.queryForObject("INSERT INTO field(farm_id,name,geom) VALUES (?,'Division',ST_GeomFromText('POLYGON((-74.82 10.02,-74.81 10.02,-74.81 10.03,-74.82 10.02))',4326)) RETURNING id", Long.class, farm);
  }
  private UsernamePasswordAuthenticationToken login(AuthDtos.User user) { return UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()); }
  private Map<String, Object> payload() {
    return new HashMap<>(Map.of("farmId", farmId, "fieldId", fieldId, "assigneeId", worker.id(), "title", "Inspeccionar división",
      "activity", "scouting", "date", "2026-10-16", "time", "07:00", "priority", "Media", "instructions", "Recorrer los linderos"));
  }
  private ResultActions create(Map<String, Object> payload, AuthDtos.User user) throws Exception {
    return mvc.perform(post("/api/v1/tasks").with(authentication(login(user))).with(csrf()).contentType("application/json").content(json.writeValueAsString(payload)));
  }
  private JsonNode created(Map<String, Object> payload, AuthDtos.User user) throws Exception {
    return json.readTree(create(payload, user).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
  }
  private ResultActions update(String id, AuthDtos.User user, String status, long version, String notes) throws Exception {
    return mvc.perform(patch("/api/v1/tasks/" + id).with(authentication(login(user))).with(csrf()).contentType("application/json")
      .content(json.writeValueAsString(Map.of("status", status, "version", version, "notes", notes))));
  }
}
