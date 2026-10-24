package com.yourco.agro.farm.repo;

import com.yourco.agro.farm.entity.Field;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FieldRepository extends JpaRepository<Field, Long> {
  List<Field> findByFarm_Id(Long farmId);
}
