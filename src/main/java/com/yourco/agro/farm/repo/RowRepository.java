package com.yourco.agro.farm.repo;

import com.yourco.agro.farm.entity.RowLine;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RowRepository extends JpaRepository<RowLine, Long> {
  List<RowLine> findByBlock_Id(Long blockId);
}
