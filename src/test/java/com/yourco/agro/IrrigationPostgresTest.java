package com.yourco.agro;

import com.yourco.agro.auth.*;
import com.yourco.agro.irrigation.IrrigationService;
import com.yourco.agro.irrigation.IrrigationDtos.*;
import com.yourco.agro.analytics.AnalyticsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest @Transactional
class IrrigationPostgresTest {
  @Autowired IrrigationService service; @Autowired AnalyticsService analytics;
  @Autowired UserService users; @Autowired JdbcTemplate jdbc;
  @Test void migrationExecutionsAndMapPreserveUnitsAndProvenance() {
    var user=users.register(new AuthDtos.RegisterRequest("Irrigation test","irrigation-"+UUID.randomUUID()+"@test.local","Password123!"));
    SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user,null,List.of()));
    try {
      long farm=jdbc.queryForObject("INSERT INTO farm(name) VALUES ('Irrigation test') RETURNING id",Long.class);
      jdbc.update("INSERT INTO farm_membership VALUES (?,?,'ADMIN')",farm,user.id());
      long field=jdbc.queryForObject("INSERT INTO field(farm_id,name,geom) VALUES (?,'Irrigation test',ST_GeomFromText('POLYGON((-75 4,-74.9 4,-74.9 4.1,-75 4.1,-75 4))',4326)) RETURNING id",Long.class,farm);
      long block=jdbc.queryForObject("INSERT INTO block(field_id,code,geom,area_ha) SELECT id,'IRR-TEST',geom,10 FROM field WHERE id=? RETURNING id",Long.class,field);
      long sectorId=((Number) service.createSector(new Sector(block,"Sector 1",BigDecimal.TEN,"Goteo","Reservorio",BigDecimal.valueOf(12),MoistureUnit.KPA,20,null,BigDecimal.TEN,BigDecimal.valueOf(30),24,"Configuración de prueba")).get("id")).longValue();
      service.measure(new Measurement(sectorId,Instant.now().minusSeconds(600),BigDecimal.valueOf(20),MoistureUnit.KPA,20,"Tensiómetro",BigDecimal.ZERO,"Sin novedades","Lectura de prueba"));
      var plan=service.schedule(new Plan(sectorId,LocalDate.now(),LocalTime.of(8,0),BigDecimal.valueOf(60),BigDecimal.valueOf(12),user.id(),"Justificación técnica","Verificar contador"));
      long planId=((Number) plan.get("id")).longValue(); service.task(planId); service.task(planId);
      var execution=service.execute(planId,new Execution(Instant.now().minusSeconds(3600),Instant.now().minusSeconds(1800),BigDecimal.ZERO,VolumeMode.METER,VolumeUnit.L,BigDecimal.ZERO,BigDecimal.valueOf(6000),null,null,"Medido"));
      assertThat(new BigDecimal(execution.get("volumeM3").toString())).isEqualByComparingTo("6");
      assertThat(jdbc.queryForObject("SELECT event_type::text FROM field_event WHERE id=?",String.class,execution.get("eventId"))).isEqualTo("IRRIGATION_EVENT");
      assertThat(service.forBlock(block).get(0).get("condition")).isEqualTo("IN_RANGE");
      assertThat(analytics.map(farm,"moisture").get("features")).asList().hasSize(1);
      assertThat(new BigDecimal(analytics.dashboard(farm).get("water_volume").toString())).isEqualByComparingTo("6");
    } finally { SecurityContextHolder.clearContext(); }
  }
}
