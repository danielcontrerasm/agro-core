package com.yourco.agro;

import com.yourco.agro.auth.AuthDtos;
import com.yourco.agro.auth.UserService;
import com.yourco.agro.fertilization.FertilizationService;
import com.yourco.agro.fertilization.FertilizationDtos.*;
import com.yourco.agro.persistence.JpaSql;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest @Transactional
class FertilizationPostgresTest {
  @Autowired FertilizationService service;
  @Autowired JpaSql queries;
  @Autowired UserService users;
  @Test void persistsApprovedPlanApplicationsAndLatestSampleInPostgis() {
    var user=users.register(new AuthDtos.RegisterRequest("Fertilization test","fert-"+UUID.randomUUID()+"@test.local","Password123!"));
    SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user,null,List.of()));
    try {
      long farm=queries.value("INSERT INTO farm(name) VALUES ('Fertilization test') RETURNING id",Long.class);
      queries.execute("INSERT INTO farm_membership VALUES (?,?,'ADMIN')",farm,user.id());
      long field=queries.value("INSERT INTO field(farm_id,name,geom) VALUES (?,'Fertilization test',ST_GeomFromText('POLYGON((-75 4,-74.9 4,-74.9 4.1,-75 4.1,-75 4))',4326)) RETURNING id",Long.class,farm);
      long block=queries.value("INSERT INTO block(field_id,code,geom,area_ha) SELECT id,'FERT-TEST',geom,10 FROM field WHERE id=? RETURNING id",Long.class,field);
      var sample=service.createAnalysis(new Analysis(block,SampleType.SOIL,LocalDate.now().minusDays(3),"Lab test","REF-001",BigDecimal.valueOf(20),null,null,List.of(new Result(Nutrient.B,BigDecimal.valueOf(0.4),Unit.MG_KG,"Agua caliente")),"Prueba transaccional"));
      long sampleId=((Number) sample.get("id")).longValue();
      var plan=service.createPlan(new Plan(block,sampleId,null,"Vegetativo","Diagnóstico técnico","Objetivo revisado","Producto de prueba","Composición declarada",BigDecimal.valueOf(50),DoseUnit.G_PLANT,BigDecimal.valueOf(1000),"Manual",LocalDate.now().minusDays(2),LocalTime.of(8,0),user.id(),LocalDate.now().plusDays(10)));
      long planId=((Number) plan.get("id")).longValue();
      service.decision(planId,new Decision(0L,"Revisado"),true); service.task(planId); service.task(planId);
      var application=service.apply(planId,new Application(Instant.now().minusSeconds(3600),BigDecimal.valueOf(20),BigDecimal.valueOf(1000),"Manual","LOT-001","Prueba parcial"));
      assertThat(queries.value("SELECT event_type::text FROM field_event WHERE id=?",String.class,application.get("eventId"))).isEqualTo("FERTILIZER_APPLICATION");
      assertThat(queries.value("SELECT COUNT(*) FROM farm_task WHERE farm_id=?",Integer.class,farm)).isEqualTo(1);
      assertThat(service.latestSoil(block).get("id")).isEqualTo(sampleId);
      assertThat(service.list(farm).get("applications")).asList().hasSize(1);
    } finally { SecurityContextHolder.clearContext(); }
  }
}
