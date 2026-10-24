package com.yourco.agro.events.repo;

import com.yourco.agro.events.entity.FieldEvent;
import com.yourco.agro.events.entity.EventType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface FieldEventRepository extends JpaRepository<FieldEvent, Long> {

  @Query("select e from FieldEvent e " +
         "left join e.block b left join b.field bf " +
         "left join e.row r left join r.block rb left join rb.field rf " +
         "where (:farmId is null or bf.farm.id = :farmId or rf.farm.id = :farmId) " +
         "and (cast(:from as timestamp) is null or e.occurredAt >= :from) " +
         "and (cast(:to as timestamp) is null or e.occurredAt <= :to) " +
         "and (cast(:eventType as string) is null or e.eventType = :eventType) " +
         "and (:blockId is null or e.block.id = :blockId) " +
         "and (:rowId is null or e.row.id = :rowId)")
  List<FieldEvent> search(
    @Param("farmId") Long farmId,
    @Param("from") Instant from,
    @Param("to") Instant to,
    @Param("eventType") EventType eventType,
    @Param("blockId") Long blockId,
    @Param("rowId") Long rowId
  );

  @Query("select e.row.id, max(od.severity), count(e.id), max(e.occurredAt) " +
         "from FieldEvent e join ObservationDetail od on od.eventId = e.id " +
         "where e.eventType = 'SCOUTING_OBSERVATION' and e.row is not null " +
         "and (:farmId is null or e.row.block.field.farm.id = :farmId) " +
         "and (cast(:from as timestamp) is null or e.occurredAt >= :from) " +
         "and (cast(:to as timestamp) is null or e.occurredAt <= :to) " +
         "group by e.row.id")
  List<Object[]> aggregateRowDisease(
    @Param("farmId") Long farmId,
    @Param("from") Instant from,
    @Param("to") Instant to
  );
}
