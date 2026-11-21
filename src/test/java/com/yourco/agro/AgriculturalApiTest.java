package com.yourco.agro;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

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
class AgriculturalApiTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired UserService users;
  @Autowired JdbcTemplate jdbc;

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

    long cycleId = jdbc.queryForObject("""
      INSERT INTO crop_cycle(block_id,code,crop,variety,planned_planting_from,planned_planting_to,expected_harvest_on,created_by)
      VALUES (?, 'CICLO-TEST-1', 'Banano', 'Cavendish', DATE '2026-01-01', DATE '2026-01-15', DATE '2027-01-15', ?)
      RETURNING id
      """, Long.class, block.get("id").asLong(), user.id());
    create("monitoring-records", Map.of(
      "recordType", "SOIL_SAMPLE", "recordedAt", "2026-10-16T14:00:00Z",
      "blockId", block.get("id").asLong(), "sampleType", "SURFACE",
      "ph", 6.2, "nitrogen", 18.4, "phosphorus", 11.0, "potassium", 205.0,
      "nutrientDeficiencies", "Magnesium"), login);
    var harvest = create("monitoring-records", Map.ofEntries(
      Map.entry("recordType", "HARVEST"), Map.entry("recordedAt", "2026-10-17T06:00:00Z"),
      Map.entry("fieldId", field.get("id").asLong()), Map.entry("blockId", block.get("id").asLong()),
      Map.entry("rowId", row.get("id").asLong()), Map.entry("cropCycleId", cycleId),
      Map.entry("actualHarvestDate", "2026-10-17"), Map.entry("harvestedAreaHa", 2.5),
      Map.entry("estimatedYield", 1200.0), Map.entry("harvestedQuantity", 1180.0),
      Map.entry("yieldUnit", "kg"), Map.entry("qualityGrade", "A"),
      Map.entry("rejectedQuantity", 20.0), Map.entry("rejectedReason", "Daño mecánico")), login);
    var fieldHarvest = create("monitoring-records", Map.ofEntries(
      Map.entry("recordType", "HARVEST"), Map.entry("recordedAt", "2026-10-18T06:00:00Z"),
      Map.entry("fieldId", field.get("id").asLong()), Map.entry("actualHarvestDate", "2026-10-18"),
      Map.entry("harvestedAreaHa", 4.0), Map.entry("estimatedYield", 800.0),
      Map.entry("harvestedQuantity", 760.0), Map.entry("yieldUnit", "kg"), Map.entry("qualityGrade", "B")), login);
    assertThat(fieldHarvest.get("fieldId").asLong()).isEqualTo(field.get("id").asLong());
    assertThat(fieldHarvest.get("blockId").isNull()).isTrue();
    mvc.perform(get("/api/v1/monitoring-records").param("blockId", block.get("id").asText())
        .param("recordType", "SOIL_SAMPLE").with(authentication(login)))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].ph").value(6.2))
      .andExpect(jsonPath("$[0].nutrientDeficiencies").value("Magnesium"));
    mvc.perform(get("/api/v1/monitoring-records").param("cropCycleId", String.valueOf(cycleId))
        .param("recordType", "HARVEST").with(authentication(login)))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].fieldId").value(field.get("id").asLong()))
      .andExpect(jsonPath("$[0].blockId").value(block.get("id").asLong()))
      .andExpect(jsonPath("$[0].rowId").value(row.get("id").asLong()))
      .andExpect(jsonPath("$[0].cropCycleId").value(cycleId))
      .andExpect(jsonPath("$[0].actualHarvestDate").value("2026-10-17"))
      .andExpect(jsonPath("$[0].harvestedAreaHa").value(2.5))
      .andExpect(jsonPath("$[0].rejectedQuantity").value(20.0))
      .andExpect(jsonPath("$[0].rejectedReason").value("Daño mecánico"));
    mvc.perform(patch("/api/v1/monitoring-records/" + harvest.get("id").asLong()).with(authentication(login)).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(Map.ofEntries(
          Map.entry("recordType", "HARVEST"), Map.entry("recordedAt", "2026-10-17T07:00:00Z"),
          Map.entry("fieldId", field.get("id").asLong()), Map.entry("blockId", block.get("id").asLong()),
          Map.entry("rowId", row.get("id").asLong()), Map.entry("cropCycleId", cycleId),
          Map.entry("actualHarvestDate", "2026-10-17"), Map.entry("harvestedAreaHa", 2.7),
          Map.entry("estimatedYield", 1250.0), Map.entry("harvestedQuantity", 1210.0),
          Map.entry("yieldUnit", "kg"), Map.entry("qualityGrade", "PREMIUM"),
          Map.entry("rejectedQuantity", 12.0), Map.entry("rejectedReason", "Daño de transporte"),
          Map.entry("notes", "Registro corregido por supervisión")))))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.recordedAt").value("2026-10-17T07:00:00Z"))
      .andExpect(jsonPath("$.harvestedAreaHa").value(2.7))
      .andExpect(jsonPath("$.qualityGrade").value("PREMIUM"))
      .andExpect(jsonPath("$.rejectedReason").value("Daño de transporte"));
  }

  private JsonNode create(String resource, Map<String, ?> payload, UsernamePasswordAuthenticationToken login) throws Exception {
    var result = mvc.perform(post("/api/v1/" + resource).with(authentication(login)).with(csrf())
        .contentType("application/json").content(json.writeValueAsString(payload)))
      .andExpect(status().isOk()).andReturn();
    return json.readTree(result.getResponse().getContentAsString());
  }
}
