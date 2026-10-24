package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthPostgresTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  @Test
  void ownerCanAssignAndChangeRolesWithImmediateEffectOnExistingSessions() throws Exception {
    String owner = "owner-" + UUID.randomUUID() + "@example.com";
    String worker = "worker-" + UUID.randomUUID() + "@example.com";
    register(owner);
    register(worker);
    var ownerSession = login(owner);
    var workerSession = login(worker);
    var result = mvc.perform(post("/api/v1/farms").session(ownerSession).with(csrf())
        .contentType("application/json").content("{\"name\":\"Membership Test Farm\"}"))
      .andExpect(status().isOk()).andReturn();
    long farmId = json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    String members = "/api/v1/farms/" + farmId + "/members";

    mvc.perform(get("/api/v1/farms/" + farmId).session(workerSession)).andExpect(status().isForbidden());
    mvc.perform(put(members).session(ownerSession).with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(java.util.Map.of("email", worker, "role", "WORKER"))))
      .andExpect(status().isOk()).andExpect(jsonPath("role").value("WORKER"));
    mvc.perform(get("/api/v1/farms/" + farmId).session(workerSession)).andExpect(status().isOk());
    mvc.perform(get(members).session(workerSession)).andExpect(status().isForbidden());
    mvc.perform(put(members).session(ownerSession).with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(java.util.Map.of("email", worker, "role", "SUPERVISOR"))))
      .andExpect(status().isOk()).andExpect(jsonPath("role").value("SUPERVISOR"));
    mvc.perform(get(members).session(workerSession)).andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(2));
    mvc.perform(put(members).session(workerSession).with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(java.util.Map.of("email", worker, "role", "ADMIN"))))
      .andExpect(status().isForbidden());
    mvc.perform(delete("/api/v1/farms/" + farmId).session(workerSession).with(csrf()))
      .andExpect(status().isForbidden());
  }

  @Test
  void agronomistCanConfigureRegionalCalendarWithoutTeamAdministration() throws Exception {
    String owner = "calendar-owner-" + UUID.randomUUID() + "@example.com";
    String agronomist = "agronomist-" + UUID.randomUUID() + "@example.com";
    register(owner);
    register(agronomist);
    var ownerSession = login(owner);
    var result = mvc.perform(post("/api/v1/farms").session(ownerSession).with(csrf())
        .contentType("application/json").content("{\"name\":\"Calendar Farm\",\"region\":\"Zona Bananera\"}"))
      .andExpect(status().isOk()).andReturn();
    long farmId = json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    String members = "/api/v1/farms/" + farmId + "/members";
    mvc.perform(put(members).session(ownerSession).with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(java.util.Map.of("email", agronomist, "role", "AGRONOMIST"))))
      .andExpect(status().isOk()).andExpect(jsonPath("role").value("AGRONOMIST"));

    var agronomistSession = login(agronomist);
    var catalog = mvc.perform(get("/api/v1/catalog/crops?farmId=" + farmId).session(agronomistSession))
      .andExpect(status().isOk()).andReturn();
    long cropId = json.readTree(catalog.getResponse().getContentAsString()).get(0).get("id").asLong();
    long varietyId = json.readTree(catalog.getResponse().getContentAsString()).get(0).get("varieties").get(0).get("id").asLong();
    mvc.perform(post("/api/v1/planting-calendars").session(agronomistSession).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(java.util.Map.ofEntries(
          java.util.Map.entry("farmId", farmId), java.util.Map.entry("region", "Zona Bananera"),
          java.util.Map.entry("cropId", cropId), java.util.Map.entry("varietyId", varietyId),
          java.util.Map.entry("seasonName", "Ventana principal"), java.util.Map.entry("windowFromMonth", 3),
          java.util.Map.entry("windowFromDay", 1), java.util.Map.entry("windowToMonth", 6),
          java.util.Map.entry("windowToDay", 30), java.util.Map.entry("perennial", false),
          java.util.Map.entry("preparationLeadDays", 30), java.util.Map.entry("notes", "Regla de integración")))))
      .andExpect(status().isCreated()).andExpect(jsonPath("cropId").value(cropId));
    mvc.perform(get("/api/v1/planting-calendars/suggestions?farmId=" + farmId + "&cropId=" + cropId + "&varietyId=" + varietyId)
        .session(agronomistSession)).andExpect(status().isOk()).andExpect(jsonPath("[0].seasonName").value("Ventana principal"));
    mvc.perform(get(members).session(agronomistSession)).andExpect(status().isForbidden());
  }

  private void register(String email) throws Exception {
    mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(java.util.Map.of("name", "Test User", "email", email,
          "password", "test-password-123"))))
      .andExpect(status().isCreated());
  }

  private MockHttpSession login(String email) throws Exception {
    var result = mvc.perform(post("/api/v1/auth/login").with(csrf()).contentType("application/json")
        .content(json.writeValueAsString(java.util.Map.of("email", email, "password", "test-password-123"))))
      .andExpect(status().isOk()).andReturn();
    return (MockHttpSession) result.getRequest().getSession(false);
  }
}
