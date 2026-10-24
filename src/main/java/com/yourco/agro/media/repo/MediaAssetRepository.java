package com.yourco.agro.media.repo;

import com.yourco.agro.media.entity.MediaAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {
  List<MediaAsset> findByEvent_Id(Long eventId);
}
