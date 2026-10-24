package com.yourco.agro.farm.repo;

import com.yourco.agro.farm.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BlockRepository extends JpaRepository<Block, Long> {
  List<Block> findByField_Id(Long fieldId);
}
