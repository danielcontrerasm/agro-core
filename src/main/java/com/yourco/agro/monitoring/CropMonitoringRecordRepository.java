package com.yourco.agro.monitoring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface CropMonitoringRecordRepository extends JpaRepository<CropMonitoringRecord, Long> {
  interface HarvestTotals {
    Double getHarvestedQuantity();
    String getGrowthStage();
    Double getEstimatedYield();
  }

  @Query("""
    select coalesce(sum(r.harvestedQuantity), 0.0) as harvestedQuantity,
           max(r.growthStage) as growthStage,
           coalesce(sum(r.estimatedYield), 0.0) as estimatedYield
    from CropMonitoringRecord r
    where r.block.id = :blockId and r.recordType = com.yourco.agro.monitoring.MonitoringRecordType.HARVEST
    """)
  HarvestTotals harvestTotals(@Param("blockId") Long blockId);

  @Query("""
    select r from CropMonitoringRecord r
    where (:blockId is null or r.block.id = :blockId)
      and (:fieldId is null or r.field.id = :fieldId)
      and (:cropCycleId is null or r.cropCycleId = :cropCycleId)
      and (:recordType is null or r.recordType = :recordType)
      and (cast(:fromTime as timestamp) is null or r.recordedAt >= :fromTime)
      and (cast(:toTime as timestamp) is null or r.recordedAt <= :toTime)
    order by r.recordedAt desc
    """)
  List<CropMonitoringRecord> search(@Param("blockId") Long blockId,
                                    @Param("fieldId") Long fieldId,
                                    @Param("cropCycleId") Long cropCycleId,
                                    @Param("recordType") MonitoringRecordType recordType,
                                    @Param("fromTime") Instant fromTime,
                                    @Param("toTime") Instant toTime);
}
