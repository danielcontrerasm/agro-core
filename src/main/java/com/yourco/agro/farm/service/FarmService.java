package com.yourco.agro.farm.service;

import com.yourco.agro.farm.dto.FarmDtos;
import com.yourco.agro.farm.entity.Farm;
import com.yourco.agro.farm.repo.FarmRepository;
import org.springframework.stereotype.Service;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FarmService {
  private final FarmRepository repo;
  private final FarmAccess access;
  private final JpaSql queries;
  public FarmService(FarmRepository repo, FarmAccess access, JpaSql queries) {
    this.repo = repo;
    this.access = access;
    this.queries = queries;
  }

  @Transactional
  public Farm create(FarmDtos.CreateFarmRequest req) {
    Farm f = new Farm();
    f.setName(req.name);
    f.setCountry(req.country);
    f.setRegion(req.region);
    Farm saved = repo.saveAndFlush(f);
    queries.execute("INSERT INTO farm_membership (farm_id, user_id, role) VALUES (?, ?, 'ADMIN')",
      saved.getId(), access.userId());
    if (catalogTablesAvailable()) {
      queries.execute("INSERT INTO crop_catalog(farm_id,code,name,created_by) VALUES (?, 'banana', 'Banano', ?)",
        saved.getId(), access.userId());
      queries.execute("""
        INSERT INTO crop_variety(crop_id,code,name,created_by)
        SELECT id,'cavendish','Cavendish',? FROM crop_catalog WHERE farm_id=? AND code='banana'
        """, access.userId(), saved.getId());
    }
    return saved;
  }

  private boolean catalogTablesAvailable() {
    return queries.value("SELECT COUNT(*) FROM information_schema.tables WHERE LOWER(table_name) IN ('crop_catalog', 'crop_variety')", Integer.class) == 2;
  }
}
