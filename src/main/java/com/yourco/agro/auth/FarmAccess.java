package com.yourco.agro.auth;

import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@Service
public class FarmAccess {
  private final JpaSql queries;

  public FarmAccess(JpaSql queries) { this.queries = queries; }

  public Long userId() {
    return ((AuthDtos.User) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).id();
  }

  public List<Long> farmIds() {
    return queries.values("SELECT farm_id FROM farm_membership WHERE user_id = ?", Long.class, userId());
  }

  public void require(Long farmId, boolean manage) {
    var roles = queries.values("SELECT role FROM farm_membership WHERE farm_id = ? AND user_id = ?",
      String.class, farmId, userId());
    if (roles.isEmpty() || (manage && !Set.of("ADMIN", "SUPERVISOR").contains(roles.get(0)))) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Farm access denied");
    }
  }

  public void requireAgronomic(Long farmId) {
    var roles = queries.values("SELECT role FROM farm_membership WHERE farm_id = ? AND user_id = ?",
      String.class, farmId, userId());
    if (roles.isEmpty() || !Set.of("ADMIN", "SUPERVISOR", "AGRONOMIST").contains(roles.get(0))) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Agronomic access required");
    }
  }

  public void requireAdmin(Long farmId) {
    require(farmId, true);
    String role = queries.value("SELECT role FROM farm_membership WHERE farm_id = ? AND user_id = ?",
      String.class, farmId, userId());
    if (!"ADMIN".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator required");
  }

  public Long fieldFarm(Long fieldId) {
    return targetFarm("SELECT farm_id FROM field WHERE id = ?", fieldId);
  }

  public Long blockFarm(Long blockId) {
    return targetFarm("SELECT f.farm_id FROM block b JOIN field f ON f.id = b.field_id WHERE b.id = ?", blockId);
  }

  public Long rowFarm(Long rowId) {
    return targetFarm("""
      SELECT f.farm_id FROM row_line r JOIN block b ON b.id = r.block_id
      JOIN field f ON f.id = b.field_id WHERE r.id = ?
      """, rowId);
  }

  public Long eventFarm(Long eventId) {
    return targetFarm("""
      SELECT f.farm_id FROM field_event e
      LEFT JOIN row_line r ON r.id = e.row_id
      JOIN block b ON b.id = COALESCE(e.block_id, r.block_id)
      JOIN field f ON f.id = b.field_id WHERE e.id = ?
      """, eventId);
  }

  public Long monitoringRecordFarm(Long recordId) {
    return targetFarm("""
      SELECT f.farm_id FROM crop_monitoring_record r
      LEFT JOIN block b ON b.id = r.block_id
      JOIN field f ON f.id = COALESCE(r.field_id, b.field_id)
      WHERE r.id = ?
      """, recordId);
  }

  private Long targetFarm(String query, Long id) {
    return queries.values(query, Long.class, id).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found"));
  }
}
