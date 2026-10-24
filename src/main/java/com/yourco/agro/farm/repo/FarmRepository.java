package com.yourco.agro.farm.repo;

import com.yourco.agro.farm.entity.Farm;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FarmRepository extends JpaRepository<Farm, Long> {}
