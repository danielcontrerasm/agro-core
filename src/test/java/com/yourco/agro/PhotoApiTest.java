package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.config.SecurityConfig;
import com.yourco.agro.media.PhotoController;
import com.yourco.agro.media.PhotoService;
import com.yourco.agro.persistence.JpaSql;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PhotoController.class)
@Import({SecurityConfig.class, FarmAccess.class, PhotoService.class, PhotoApiTest.DatabaseConfig.class})
class PhotoApiTest {
  @TestConfiguration
  @Import(JpaTestConfig.class)
  static class DatabaseConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory() throws IOException {
      return JpaTestConfig.database(
        "auth-schema.sql",
        "db/migration/V2__users_and_memberships.sql",
        "db/migration/V6__phytosanitary_inspections.sql",
        "db/migration/V7__inspection_treatments_and_evidence.sql",
        "photo-schema.sql",
        "db/migration/V33__fertilization_sample_photos.sql"
      );
    }
  }

  @Autowired MockMvc mvc;
  @Autowired JpaSql queries;
  @Autowired ObjectMapper json;

  private UsernamePasswordAuthenticationToken login() {
    return login(1L);
  }

  private UsernamePasswordAuthenticationToken login(long id) {
    return UsernamePasswordAuthenticationToken.authenticated(
      new AuthDtos.User(id, "User " + id, "user" + id + "@example.com"), null, List.of());
  }

  @BeforeEach void seed() {
    queries.execute("DELETE FROM photo_asset"); queries.execute("DELETE FROM soil_analysis");
    queries.execute("DELETE FROM inspection_evidence"); queries.execute("DELETE FROM inspection_treatment");
    queries.execute("DELETE FROM phytosanitary_inspection"); queries.execute("DELETE FROM farm_membership");
    queries.execute("DELETE FROM app_user"); queries.execute("DELETE FROM field_event"); queries.execute("DELETE FROM row_line");
    queries.execute("DELETE FROM block"); queries.execute("DELETE FROM field"); queries.execute("DELETE FROM farm");
    queries.execute("INSERT INTO farm VALUES (10, 'North'), (20, 'South')");
    queries.execute("INSERT INTO field VALUES (11, 10), (21, 20)");
    queries.execute("INSERT INTO block(id, field_id) VALUES (12, 11), (22, 21)");
    queries.execute("INSERT INTO field_event VALUES (14, 12, NULL), (24, 22, NULL)");
    queries.execute("""
      INSERT INTO app_user(id, name, email, password_hash) VALUES
        (1, 'Worker', 'worker@example.com', 'hash'),
        (2, 'Peer', 'peer@example.com', 'hash'),
        (3, 'Supervisor', 'supervisor@example.com', 'hash')
      """);
    queries.execute("INSERT INTO farm_membership VALUES (10, 1, 'WORKER'), (10, 2, 'WORKER'), (10, 3, 'SUPERVISOR')");
    queries.execute("""
      INSERT INTO phytosanitary_inspection(id, block_id, problem_code, inspected_at, inspected_plants,
        affected_plants, symptoms, severity_percent, severity_method, next_visit, created_by_user_id)
      VALUES (30, 12, 'SIGATOKA', CURRENT_TIMESTAMP, 20, 2, 'Manchas', 10, 'Visual', CURRENT_DATE, 1),
        (31, 12, 'MOKO', CURRENT_TIMESTAMP, 20, 1, 'Marchitez', 5, 'Visual', CURRENT_DATE, 1),
        (32, 22, 'SIGATOKA', CURRENT_TIMESTAMP, 20, 2, 'Manchas', 10, 'Visual', CURRENT_DATE, 1)
      """);
    queries.execute("INSERT INTO inspection_treatment(id, inspection_id, occurred_at, description, created_by_user_id) VALUES (40, 30, CURRENT_TIMESTAMP, 'Deshoje', 1), (41, 31, CURRENT_TIMESTAMP, 'Inspección', 1)");
    queries.execute("""
      INSERT INTO soil_analysis(id, block_id, sampled_on, details, created_by)
      VALUES (50, 12, CURRENT_DATE, '{}', 1), (51, 22, CURRENT_DATE, '{}', 1)
      """);
  }

  private MockMultipartFile photo(String format) throws Exception {
    var image = new BufferedImage(12, 8, BufferedImage.TYPE_INT_RGB);
    image.setRGB(0, 0, 0x00ff00);
    var output = new ByteArrayOutputStream(); ImageIO.write(image, format, output);
    return new MockMultipartFile("file", "campo." + format, "image/" + format, output.toByteArray());
  }

  private String upload(String target, String value) throws Exception {
    var response = mvc.perform(multipart("/api/v1/photos").file(photo("png")).param(target, value).with(authentication(login())).with(csrf()))
      .andExpect(status().isOk()).andExpect(jsonPath("contentType").value("image/png")).andReturn();
    return json.readTree(response.getResponse().getContentAsString()).get("id").asText();
  }

  @Test void eventPhotoRoundTripIncludesAuthenticatedPreviewAndDownload() throws Exception {
    String id = upload("eventId", "14");
    mvc.perform(get("/api/v1/photos").param("eventId", "14").with(authentication(login())))
      .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id)).andExpect(jsonPath("$[0].createdByUserId").value(1));
    var result = mvc.perform(get("/api/v1/photos/" + id + "/content").with(authentication(login())))
      .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
      .andExpect(header().string("Cache-Control", "no-store")).andExpect(header().string("X-Content-Type-Options", "nosniff")).andReturn();
    var decoded = ImageIO.read(new ByteArrayInputStream(result.getResponse().getContentAsByteArray()));
    assertThat(decoded.getWidth()).isEqualTo(12); assertThat(decoded.getHeight()).isEqualTo(8);
    mvc.perform(get("/api/v1/photos/" + id + "/content").param("download", "true").with(authentication(login())))
      .andExpect(status().isOk()).andExpect(header().string("Content-Disposition", "attachment; filename=\"foto-" + id + ".png\""));
    mvc.perform(get("/api/v1/photos/" + id + "/content")).andExpect(status().isUnauthorized());
    queries.execute("DELETE FROM farm_membership WHERE user_id = 1");
    mvc.perform(get("/api/v1/photos/" + id + "/content").with(authentication(login()))).andExpect(status().isForbidden());
    queries.execute("DELETE FROM field_event WHERE id = 14");
    assertThat(queries.value("SELECT COUNT(*) FROM photo_asset WHERE id = ?", Integer.class, id)).isZero();
  }

  @Test void inspectionAndTreatmentPhotosKeepTheirTargetAndSurviveAnnulment() throws Exception {
    upload("inspectionId", "30");
    mvc.perform(multipart("/api/v1/photos").file(photo("jpeg")).param("inspectionId", "30").param("treatmentId", "40").with(authentication(login())).with(csrf()))
      .andExpect(status().isOk()).andExpect(jsonPath("treatmentId").value(40)).andExpect(jsonPath("contentType").value("image/jpeg"));
    mvc.perform(get("/api/v1/photos").param("inspectionId", "30").with(authentication(login())))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
    mvc.perform(get("/api/v1/photos").param("inspectionId", "30").param("treatmentId", "40").with(authentication(login())))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("inspectionId", "30").param("treatmentId", "41").with(authentication(login())).with(csrf())).andExpect(status().isBadRequest());
    queries.execute("UPDATE phytosanitary_inspection SET canceled_at = CURRENT_TIMESTAMP WHERE id = 30");
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("inspectionId", "30").with(authentication(login())).with(csrf())).andExpect(status().isConflict());
    mvc.perform(get("/api/v1/photos").param("inspectionId", "30").with(authentication(login())))
      .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
  }

  @Test void uploadRejectsForeignTargetsInvalidImagesAmbiguousTargetsAndMissingCsrf() throws Exception {
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("eventId", "24").with(authentication(login())).with(csrf())).andExpect(status().isForbidden());
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("inspectionId", "32").with(authentication(login())).with(csrf())).andExpect(status().isForbidden());
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("eventId", "14").param("inspectionId", "30").with(authentication(login())).with(csrf())).andExpect(status().isBadRequest());
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("eventId", "14").with(authentication(login()))).andExpect(status().isForbidden());
    mvc.perform(multipart("/api/v1/photos").file(new MockMultipartFile("file", "fake.png", "image/png", "<script>alert(1)</script>".getBytes())).param("eventId", "14").with(authentication(login())).with(csrf()))
      .andExpect(status().isUnsupportedMediaType());
    mvc.perform(multipart("/api/v1/photos").file(new MockMultipartFile("file", "large.jpg", "image/jpeg", new byte[PhotoService.MAX_BYTES + 1])).param("eventId", "14").with(authentication(login())).with(csrf()))
      .andExpect(status().isPayloadTooLarge());
  }

  @Test void samplePhotosPersistAndRespectFarmMembershipAndWritePermissions() throws Exception {
    String id = upload("analysisId", "50");
    mvc.perform(get("/api/v1/photos").param("analysisId", "50").with(authentication(login(2))))
      .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id)).andExpect(jsonPath("$[0].analysisId").value(50));
    mvc.perform(get("/api/v1/photos/" + id + "/content").param("download", "true").with(authentication(login(2))))
      .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
      .andExpect(header().string("Content-Disposition", "attachment; filename=\"foto-" + id + ".png\""));
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("analysisId", "50").with(authentication(login(2))).with(csrf()))
      .andExpect(status().isForbidden());
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("analysisId", "50").with(authentication(login(3))).with(csrf()))
      .andExpect(status().isOk()).andExpect(jsonPath("createdByUserId").value(3));
    mvc.perform(get("/api/v1/photos").param("analysisId", "51").with(authentication(login())))
      .andExpect(status().isForbidden());
    mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("analysisId", "51").with(authentication(login())).with(csrf()))
      .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/photos").param("analysisId", "999").with(authentication(login())))
      .andExpect(status().isNotFound());
    queries.execute("DELETE FROM farm_membership WHERE user_id = 2");
    mvc.perform(get("/api/v1/photos/" + id + "/content").with(authentication(login(2)))).andExpect(status().isForbidden());
    queries.execute("DELETE FROM soil_analysis WHERE id = 50");
    assertThat(queries.value("SELECT COUNT(*) FROM photo_asset WHERE analysis_id = ?", Integer.class, 50)).isZero();
  }

  @Test void samplePhotoTargetCannotBeCombinedWithOtherTargets() throws Exception {
    for (String otherTarget : List.of("eventId", "inspectionId", "treatmentId")) {
      mvc.perform(multipart("/api/v1/photos").file(photo("png")).param("analysisId", "50")
        .param(otherTarget, "14").with(authentication(login())).with(csrf()))
        .andExpect(status().isBadRequest());
    }
  }
}
