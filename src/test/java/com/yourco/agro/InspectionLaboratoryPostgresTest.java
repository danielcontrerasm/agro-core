package com.yourco.agro;

import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.UserService;
import com.yourco.agro.inspections.InspectionDtos;
import com.yourco.agro.inspections.InspectionLaboratoryDtos;
import com.yourco.agro.inspections.InspectionLaboratoryService;
import com.yourco.agro.inspections.InspectionService;
import com.yourco.agro.persistence.JpaSql;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class InspectionLaboratoryPostgresTest {
  @Autowired UserService users;
  @Autowired JpaSql queries;
  @Autowired InspectionService inspections;
  @Autowired InspectionLaboratoryService laboratory;

  @Test
  void persistsLinkedLaboratoryResultWithNativeUuidAndDates() {
    var user = users.register(new AuthDtos.RegisterRequest("Laboratorio QA",
      "lab-" + UUID.randomUUID() + "@example.com", "test-password-123"));
    SecurityContextHolder.getContext().setAuthentication(
      UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
    try {
      long farm = queries.insert("INSERT INTO farm(name) VALUES ('Finca QA de laboratorio')");
      queries.execute("INSERT INTO farm_membership VALUES (?, ?, 'AGRONOMIST')", farm, user.id());
      long field = queries.insert("""
        INSERT INTO field(farm_id, name, geom)
        VALUES (?, 'Campo QA', ST_GeomFromText('POLYGON((-75 4,-74.9 4,-74.9 4.1,-75 4))',4326))
        """, farm);
      long block = queries.insert("""
        INSERT INTO block(field_id, code, geom, area_ha) SELECT id, 'B-QA', geom, 10 FROM field WHERE id = ?
        """, field);
      var today = LocalDate.now(ZoneOffset.UTC);
      var inspection = inspections.create(new InspectionDtos.CreateRequest(block, null, "SIGATOKA",
        today.minusDays(3).atStartOfDay(ZoneOffset.UTC).toInstant(), 20, 4, 1.0, "Observación QA", 10.0,
        "Evaluación visual", today.plusDays(1), null));

      var request = new InspectionLaboratoryDtos.RecordResult("MUESTRA-QA-1", "Laboratorio QA", today.minusDays(2),
        today, InspectionLaboratoryDtos.Outcome.CONFIRMED, null, "Informe QA 001", UUID.randomUUID());
      var saved = laboratory.record(inspection.id(), request);
      assertThat(saved.createdByUserId()).isEqualTo(user.id());
      assertThat(saved.sampledOn()).isEqualTo(request.sampledOn());
      assertThat(saved.resultOn()).isEqualTo(request.resultOn());
      assertThat(laboratory.record(inspection.id(), request)).isEqualTo(saved);
      assertThat(laboratory.list(inspection.id())).containsExactly(saved);
      assertThat(inspections.get(inspection.id()).assessmentStatus()).isEqualTo(InspectionDtos.AssessmentStatus.SUSPECTED);
      inspections.cancel(inspection.id(), new InspectionDtos.CancelRequest("Inspección duplicada", 0L));
      assertThat(laboratory.list(inspection.id())).containsExactly(saved);
    } finally {
      SecurityContextHolder.clearContext();
    }
  }
}
