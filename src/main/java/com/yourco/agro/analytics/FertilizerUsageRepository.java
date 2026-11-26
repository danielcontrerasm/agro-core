package com.yourco.agro.analytics;

import com.yourco.agro.persistence.JpaSql;
import java.math.BigDecimal;
import org.springframework.stereotype.Repository;

@Repository
class FertilizerUsageRepository {
  private final JpaSql queries;

  FertilizerUsageRepository(JpaSql queries) {
    this.queries = queries;
  }

  BigDecimal sumAppliedQuantity(long farmId) {
    return queries.value("""
      SELECT COALESCE(SUM(quantity), 0)
      FROM (
        SELECT CAST(r.quantity AS NUMERIC) AS quantity
        FROM crop_monitoring_record r
        LEFT JOIN block b ON b.id = r.block_id
        JOIN field f ON f.id = COALESCE(b.field_id, r.field_id)
        WHERE f.farm_id = ? AND r.record_type = 'FERTILIZER_APPLICATION'
        UNION ALL
        SELECT a.quantity
        FROM fertilization_application a
        JOIN fertilization_plan p ON p.id = a.plan_id
        JOIN block b ON b.id = p.block_id
        JOIN field f ON f.id = b.field_id
        WHERE f.farm_id = ?
      ) applications
      """, BigDecimal.class, farmId, farmId);
  }
}
