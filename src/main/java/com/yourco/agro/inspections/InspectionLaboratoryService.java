package com.yourco.agro.inspections;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;

import static com.yourco.agro.inspections.InspectionLaboratoryDtos.*;

@Service
public class InspectionLaboratoryService {
  private static final String SELECT = """
    SELECT r.*, u.name AS created_by_name
    FROM inspection_laboratory_result r JOIN app_user u ON u.id = r.created_by_user_id
    """;

  private final JpaSql queries;
  private final FarmAccess access;
  private final InspectionService inspections;

  public InspectionLaboratoryService(JpaSql queries, FarmAccess access, InspectionService inspections) {
    this.queries = queries;
    this.access = access;
    this.inspections = inspections;
  }

  @Transactional(readOnly = true)
  public List<LaboratoryResult> list(long inspectionId) {
    inspections.get(inspectionId);
    return queries.select(SELECT + " WHERE r.inspection_id = ? ORDER BY r.result_on DESC, r.id DESC",
      InspectionLaboratoryService::map, inspectionId);
  }

  @Transactional
  public LaboratoryResult record(long inspectionId, RecordResult request) {
    var inspection = inspections.lockedInspection(inspectionId);
    access.requireAgronomic(inspection.farmId());
    long userId = access.userId();
    String sampleReference = request.sampleReference().strip();
    String laboratory = request.laboratory().strip();
    String notes = optionalText(request.notes());
    String reportReference = optionalText(request.reportReference());

    if (request.requestId() != null) {
      var saved = queries.select(SELECT + " WHERE r.inspection_id = ? AND r.request_id = ?",
        InspectionLaboratoryService::map, inspectionId, request.requestId()).stream().findFirst();
      if (saved.isPresent()) {
        var result = saved.get();
        if (result.createdByUserId() == userId && result.sampleReference().equals(sampleReference)
          && result.laboratory().equals(laboratory) && result.sampledOn().equals(request.sampledOn())
          && result.resultOn().equals(request.resultOn()) && result.outcome() == request.outcome()
          && Objects.equals(result.notes(), notes) && Objects.equals(result.reportReference(), reportReference)) {
          return result;
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "El identificador de solicitud ya corresponde a otro resultado");
      }
    }

    inspections.requireWritable(inspection);
    if (request.sampledOn().getYear() < 1 || request.resultOn().isBefore(request.sampledOn())
      || request.resultOn().isAfter(LocalDate.now(ZoneOffset.UTC))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
        "La fecha del resultado debe estar entre la fecha de la muestra y el día de hoy");
    }

    long id = queries.insert("""
      INSERT INTO inspection_laboratory_result (inspection_id, request_id, sample_reference, laboratory,
        sampled_on, result_on, outcome, notes, report_reference, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """, inspectionId, request.requestId(), sampleReference, laboratory, request.sampledOn(), request.resultOn(),
      request.outcome().name(), notes, reportReference, userId);
    return queries.selectOne(SELECT + " WHERE r.id = ?", InspectionLaboratoryService::map, id);
  }

  private static LaboratoryResult map(JpaSql.Row row) {
    return new LaboratoryResult(row.longValue("id"), row.longValue("inspection_id"), row.text("sample_reference"),
      row.text("laboratory"), row.date("sampled_on"), row.date("result_on"), Outcome.valueOf(row.text("outcome")),
      row.text("notes"), row.text("report_reference"), row.longValue("created_by_user_id"),
      row.text("created_by_name"), row.instant("created_at"));
  }

  private static String optionalText(String value) {
    return value == null || value.isBlank() ? null : value.strip();
  }
}
