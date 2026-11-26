package com.yourco.agro;

import com.yourco.agro.analytics.AnalyticsService;
import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.UserService;
import com.yourco.agro.fertilization.FertilizationService;
import com.yourco.agro.fertilization.FertilizationDtos.*;
import com.yourco.agro.media.PhotoService;
import com.yourco.agro.persistence.JpaSql;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest @Transactional
class FertilizationPostgresTest {
  @Autowired FertilizationService service;
  @Autowired JpaSql queries;
  @Autowired UserService users;
  @Autowired PhotoService photos;
  @Autowired AnalyticsService analytics;

  @Test void persistsApprovedPlanApplicationsUsingTheFarmDateAndIncludesThemInTheDashboard() {
    var user=users.register(new AuthDtos.RegisterRequest("Fertilization test","fert-"+UUID.randomUUID()+"@test.local","Password123!"));
    SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user,null,List.of()));
    try {
      long farm=queries.value("INSERT INTO farm(name) VALUES ('Fertilization test') RETURNING id",Long.class);
      queries.execute("INSERT INTO farm_membership VALUES (?,?,'ADMIN')",farm,user.id());
      long field=queries.value("INSERT INTO field(farm_id,name,geom) VALUES (?,'Fertilization test',ST_GeomFromText('POLYGON((-75 4,-74.9 4,-74.9 4.1,-75 4.1,-75 4))',4326)) RETURNING id",Long.class,farm);
      long block=queries.value("INSERT INTO block(field_id,code,geom,area_ha) SELECT id,'FERT-TEST',geom,10 FROM field WHERE id=? RETURNING id",Long.class,field);
      queries.insert("INSERT INTO block(field_id,code,geom,area_ha) SELECT id,'FERT-SECOND',geom,10 FROM field WHERE id=?", field);
      LocalDate appliedOn = LocalDate.of(2025, 10, 31);
      Instant occurredAt = Instant.parse("2025-11-01T01:00:00Z");
      long otherFarm = queries.insert("INSERT INTO farm(name) VALUES ('Other fertilizer records')");
      long otherField = queries.insert("INSERT INTO field(farm_id,name,geom) SELECT ?, 'Other field', geom FROM field WHERE id=?",
        otherFarm, field);
      queries.execute("""
        INSERT INTO crop_monitoring_record(record_type, field_id, recorded_at, created_by_user_id, quantity, quantity_unit)
        VALUES ('FERTILIZER_APPLICATION', ?, ?, ?, 3, 'kg'), ('FERTILIZER_APPLICATION', ?, ?, ?, 7, 'kg')
        """, field, occurredAt, user.id(), otherField, occurredAt, user.id());
      var sample=service.createAnalysis(new Analysis(block,SampleType.SOIL,appliedOn.minusDays(1),"Lab test","REF-001",BigDecimal.valueOf(20),null,null,List.of(new Result(Nutrient.B,BigDecimal.valueOf(0.4),Unit.MG_KG,"Agua caliente")),"Prueba transaccional"));
      long sampleId=((Number) sample.get("id")).longValue();
      var plan=service.createPlan(new Plan(block,sampleId,null,"Vegetativo","Diagnóstico técnico","Objetivo revisado","Producto de prueba","Composición declarada",BigDecimal.valueOf(50),DoseUnit.G_PLANT,BigDecimal.valueOf(1000),"Manual",appliedOn,LocalTime.of(8,0),user.id(),appliedOn.plusDays(10)));
      long planId=((Number) plan.get("id")).longValue();
      service.decision(planId,new Decision(0L,"Revisado"),true); service.task(planId); service.task(planId);
      long productId = queries.insert("INSERT INTO inventory_product(farm_id,code,name,category,unit,minimum) VALUES (?,'FERT','Producto de prueba','Fertilizante','kg',0)",farm);
      long lotId = queries.insert("INSERT INTO inventory_lot(farm_id,product_id,code,balance,unit_cost_cop,expires_on) VALUES (?,?,'LOT-001',30,0,?)",
        farm, productId, appliedOn);
      var request = new Application(occurredAt,BigDecimal.valueOf(20),BigDecimal.valueOf(1000),"Manual",lotId,"Prueba parcial",null,UUID.randomUUID());
      var application=service.apply(planId,request);
      assertThat(service.apply(planId,request).get("id")).isEqualTo(application.get("id"));
      assertThat(queries.value("SELECT balance FROM inventory_lot WHERE id=?",BigDecimal.class,lotId)).isEqualByComparingTo("10");
      assertThat(queries.value("SELECT amount FROM farm_financial_entry WHERE id=? AND source_type='FERTILIZATION_APPLICATION'",BigDecimal.class,application.get("financialEntryId"))).isEqualByComparingTo("0");
      assertThat(queries.value("SELECT entry_date FROM farm_financial_entry WHERE id=?", LocalDate.class,
        application.get("financialEntryId"))).isEqualTo(appliedOn);
      assertThat(queries.value("SELECT applied_on FROM inventory_movement WHERE id=?", LocalDate.class,
        application.get("inventoryMovementId"))).isEqualTo(appliedOn);
      assertThat((BigDecimal) analytics.dashboard(farm).get("fertilizer_quantity")).isEqualByComparingTo("23");
      assertThat(queries.value("SELECT event_type::text FROM field_event WHERE id=?",String.class,application.get("eventId"))).isEqualTo("FERTILIZER_APPLICATION");
      assertThat(queries.value("SELECT COUNT(*) FROM farm_task WHERE farm_id=?",Integer.class,farm)).isEqualTo(1);
      assertThat(service.latestSoil(block).get("id")).isEqualTo(sampleId);
      assertThat(service.list(farm).get("applications")).asList().hasSize(1);
    } finally { SecurityContextHolder.clearContext(); }
  }

  @Test void persistsPhotoForGeoreferencedSampleInPostgis() throws IOException {
    var user = users.register(new AuthDtos.RegisterRequest("Sample photo QA", "photo-" + UUID.randomUUID() + "@test.local", "Password123!"));
    SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
    try {
      long farm = queries.insert("INSERT INTO farm(name) VALUES ('Sample photo QA')");
      queries.execute("INSERT INTO farm_membership VALUES (?,?,'WORKER')", farm, user.id());
      long field = queries.insert("""
        INSERT INTO field(farm_id, name, geom)
        VALUES (?, 'Sample photo QA', ST_GeomFromText('POLYGON((-75 4,-74.9 4,-74.9 4.1,-75 4.1,-75 4))',4326))
        """, farm);
      long block = queries.insert("""
        INSERT INTO block(field_id, code, geom, area_ha)
        SELECT id, 'SAMPLE-PHOTO-QA', geom, 10 FROM field WHERE id = ?
        """, field);
      var sample = service.createAnalysis(new Analysis(block, SampleType.SOIL, LocalDate.now().minusDays(1),
        "Laboratorio QA", "MUESTRA-CON-FOTO", BigDecimal.valueOf(20), BigDecimal.valueOf(4.05), BigDecimal.valueOf(-74.95),
        List.of(new Result(Nutrient.B, BigDecimal.valueOf(0.4), Unit.MG_KG, "Medición QA")), "Punto de prueba"));
      long sampleId = ((Number) sample.get("id")).longValue();
      var target = new PhotoService.Target(null, null, null, sampleId);
      var buffer = new ByteArrayOutputStream();
      ImageIO.write(new BufferedImage(12, 8, BufferedImage.TYPE_INT_RGB), "png", buffer);
      var photo = photos.upload(target, new MockMultipartFile("file", "muestra-qa.png", "image/png", buffer.toByteArray()));

      assertThat(photos.list(target)).containsExactly(photo);
      var stored = photos.content(photo.id());
      assertThat(stored.photo().analysisId()).isEqualTo(sampleId);
      assertThat(ImageIO.read(new ByteArrayInputStream(stored.bytes())).getWidth()).isEqualTo(12);
      var savedSample = service.latestSoil(block);
      assertThat(((Number) savedSample.get("latitude")).doubleValue()).isEqualTo(4.05);
      assertThat(((Number) savedSample.get("longitude")).doubleValue()).isEqualTo(-74.95);
    } finally {
      SecurityContextHolder.clearContext();
    }
  }
}
