package com.yourco.agro.farm.service;

import com.yourco.agro.farm.dto.FarmDtos;
import com.yourco.agro.farm.entity.Farm;
import com.yourco.agro.farm.repo.FarmRepository;
import org.springframework.stereotype.Service;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FarmService {
  private final FarmRepository repo;
  private final FarmAccess access;
  private final JdbcTemplate jdbc;
  public FarmService(FarmRepository repo, FarmAccess access, JdbcTemplate jdbc) {
    this.repo = repo;
    this.access = access;
    this.jdbc = jdbc;
  }

  @Transactional
  public Farm create(FarmDtos.CreateFarmRequest req) {
    Farm f = new Farm();
    f.setName(req.name);
    f.setCountry(req.country);
    f.setRegion(req.region);
    Farm saved = repo.saveAndFlush(f);
    jdbc.update("INSERT INTO farm_membership (farm_id, user_id, role) VALUES (?, ?, 'ADMIN')",
      saved.getId(), access.userId());
    if (catalogTablesAvailable()) {
      jdbc.update("INSERT INTO crop_catalog(farm_id,code,name,created_by) VALUES (?, 'banana', 'Banano', ?)",
        saved.getId(), access.userId());
      jdbc.update("""
        INSERT INTO crop_variety(crop_id,code,name,created_by)
        SELECT id,'cavendish','Cavendish',? FROM crop_catalog WHERE farm_id=? AND code='banana'
        """, access.userId(), saved.getId());
    }
    return saved;
  }

  private boolean catalogTablesAvailable() {
    return jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE LOWER(table_name) IN ('crop_catalog', 'crop_variety')", Integer.class) == 2;
  }
}
