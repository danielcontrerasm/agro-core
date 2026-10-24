package com.yourco.agro;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AgriculturalApiTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired UserService users;

  @Test
  void locationsEventsObservationsAndMediaRoundTripAsUsableJson() throws Exception {
    var user = users.register(new AuthDtos.RegisterRequest("Frontend test", UUID.randomUUID() + "@example.com", "test-password-123"));
    var login = UsernamePasswordAuthenticationToken.authenticated(user, null, List.of());
    var farm = create("farms", Map.of("name", "API verification farm"), login);
    var polygon = Map.of("coordinates", List.of(List.of(List.of(-74.1, 10.5), List.of(-74.11, 10.5), List.of(-74.11, 10.51))));
    var field = create("fields", Map.of("farmId", farm.get("id").asLong(), "name", "North", "polygon", polygon), login);
    var block = create("blocks", Map.of("fieldId", field.get("id").asLong(), "code", "A", "polygon", polygon), login);
    var row = create("rows", Map.of("blockId", block.get("id").asLong(), "rowCode", "R-1", "line", Map.of("coordinates", List.of(List.of(-74.1, 10.5), List.of(-74.101, 10.501)))), login);
    mvc.perform(get("/api/v1/rows/" + row.get("id").asLong()).with(authentication(login)))
      .andExpect(status().isOk()).andExpect(jsonPath("geom.type").value("LineString"))
      .andExpect(jsonPath("block.field.geom.type").value("Polygon"))
      .andExpect(jsonPath("block.field.farm.name").value("API verification farm"))
      .andExpect(jsonPath("block.hibernateLazyInitializer").doesNotExist());

    create("events", Map.of("eventType", "IRRIGATION_EVENT", "occurredAt", "2026-10-16T12:00:00Z", "blockId", block.get("id").asLong()), login);
    var observation = create("events", Map.of("eventType", "SCOUTING_OBSERVATION", "occurredAt", "2026-10-16T13:00:00Z", "rowId", row.get("id").asLong(), "observation", Map.of("severity", 3, "symptoms", "Observed leaf spots")), login);
    mvc.perform(get("/api/v1/events").param("farmId", farm.get("id").asText()).with(authentication(login)))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
    mvc.perform(get("/api/v1/events").param("farmId", farm.get("id").asText())
        .param("eventType", "IRRIGATION_EVENT").param("from", "2026-10-16T00:00:00Z")
        .param("to", "2026-10-16T23:59:59Z").with(authentication(login)))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(get("/api/v1/map/rows/disease").param("farmId", farm.get("id").asText()).with(authentication(login)))
      .andExpect(status().isOk()).andExpect(jsonPath("features.length()").value(1))
      .andExpect(jsonPath("features[0].properties.maxSeverity").value(3))
      .andExpect(jsonPath("features[0].geometry.type").value("LineString"));
    create("media", Map.of("eventId", observation.get("id").asLong(), "kind", "IMAGE", "s3Key", "events/test.jpg", "metaJson", "{\"source\":\"frontend\"}"), login);
    mvc.perform(get("/api/v1/media").param("eventId", observation.get("id").asText()).with(authentication(login)))
      .andExpect(status().isOk()).andExpect(jsonPath("$[0].s3Key").value("events/test.jpg"));

    create("monitoring-records", Map.of(
      "recordType", "SOIL_SAMPLE", "recordedAt", "2026-10-16T14:00:00Z",
      "blockId", block.get("id").asLong(), "sampleType", "SURFACE",
      "ph", 6.2, "nitrogen", 18.4, "phosphorus", 11.0, "potassium", 205.0,
      "nutrientDeficiencies", "Magnesium"), login);
    create("monitoring-records", Map.of(
      "recordType", "HARVEST", "recordedAt", "2026-10-17T06:00:00Z",
      "blockId", block.get("id").asLong(), "estimatedYield", 1200.0,
      "harvestedQuantity", 1180.0, "yieldUnit", "kg", "qualityGrade", "A"), login);
    mvc.perform(get("/api/v1/monitoring-records").param("blockId", block.get("id").asText())
        .param("recordType", "SOIL_SAMPLE").with(authentication(login)))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].ph").value(6.2))
      .andExpect(jsonPath("$[0].nutrientDeficiencies").value("Magnesium"));
  }

  private JsonNode create(String resource, Map<String, ?> payload, UsernamePasswordAuthenticationToken login) throws Exception {
    var result = mvc.perform(post("/api/v1/" + resource).with(authentication(login)).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(payload)))
      .andExpect(status().isOk()).andReturn();
    return json.readTree(result.getResponse().getContentAsString());
  }
}
