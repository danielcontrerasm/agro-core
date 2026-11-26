package com.yourco.agro.inspections;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

import static com.yourco.agro.inspections.TreatmentFollowupDtos.*;

@Service
public class TreatmentFollowupService {
  private static final String SELECT = """
    SELECT f.*, a.name AS authorized_by_name, t.occurred_at AS executed_at,
      t.created_by_user_id AS executed_by_user_id, e.name AS executed_by_name, t.quantity, t.unit,
      v.name AS verified_by_name
    FROM inspection_treatment_followup f
    JOIN app_user a ON a.id = f.authorized_by_user_id
    LEFT JOIN inspection_treatment t ON t.id = f.treatment_id
    LEFT JOIN app_user e ON e.id = t.created_by_user_id
    LEFT JOIN app_user v ON v.id = f.verified_by_user_id
    """;

  private final JpaSql queries;
  private final FarmAccess access;
  private final InspectionService inspections;

  public TreatmentFollowupService(JpaSql queries, FarmAccess access, InspectionService inspections) {
    this.queries = queries;
    this.access = access;
    this.inspections = inspections;
  }

  @Transactional(readOnly = true)
  public List<Followup> list(long inspectionId) {
    inspections.get(inspectionId);
    return queries.select(SELECT + " WHERE f.inspection_id = ? ORDER BY f.authorized_at DESC, f.id DESC",
      TreatmentFollowupService::map, inspectionId);
  }

  @Transactional
  public Followup authorize(long inspectionId, Authorize request) {
    var inspection = inspections.writable(inspectionId);
    access.requireAgronomic(inspection.farmId());
    String description = request.description().strip();
    String product = optionalText(request.product());
    long author = access.userId();
    if (request.requestId() != null) {
      var existing = queries.select(SELECT + " WHERE f.inspection_id = ? AND f.request_id = ?",
        TreatmentFollowupService::map, inspectionId, request.requestId()).stream().findFirst();
      if (existing.isPresent()) {
        var previous = existing.get();
        if (author == previous.authorizedByUserId() && description.equals(previous.description())
          && Objects.equals(product, previous.product())) return previous;
        throw conflict("El identificador de solicitud ya corresponde a otra autorización");
      }
    }
    long id = queries.insert("""
      INSERT INTO inspection_treatment_followup(inspection_id, request_id, description, product,
        authorized_by_user_id, authorized_at) VALUES (?, ?, ?, ?, ?, ?)
      """, inspectionId, request.requestId(), description, product, author, Instant.now());
    return get(inspectionId, id);
  }

  @Transactional
  public Followup execute(long inspectionId, long id, Execute request) {
    inspections.writable(inspectionId);
    var followup = get(inspectionId, id);
    requireTransition(followup, request.version(), Status.AUTHORIZED);
    if (request.occurredAt().isBefore(followup.authorizedAt().truncatedTo(ChronoUnit.MINUTES))) {
      throw badRequest("La ejecución no puede ser anterior a la autorización");
    }
    String productLot = optionalText(request.productLot());
    if (followup.product() != null && productLot == null) throw badRequest("Registra el lote del producto aplicado");
    if (followup.product() == null && productLot != null) throw badRequest("El lote debe corresponder a un producto autorizado");
    if (request.quantity() != null && !Double.isFinite(request.quantity())) throw badRequest("La cantidad no es válida");
    var treatment = inspections.addTreatment(inspectionId, new InspectionDtos.TreatmentRequest(
      request.occurredAt(), followup.description(), followup.product(), request.quantity(), optionalText(request.unit())));
    queries.execute("""
      UPDATE inspection_treatment_followup SET treatment_id = ?, product_lot = ?, version = version + 1 WHERE id = ?
      """, treatment.id(), productLot, id);
    return get(inspectionId, id);
  }

  @Transactional
  public Followup verify(long inspectionId, long id, Verify request) {
    var inspection = inspections.writable(inspectionId);
    access.requireAgronomic(inspection.farmId());
    var followup = get(inspectionId, id);
    requireTransition(followup, request.version(), Status.EXECUTED);
    if (request.verifiedAt().isBefore(followup.executedAt().truncatedTo(ChronoUnit.MINUTES))) {
      throw badRequest("La verificación no puede ser anterior a la ejecución");
    }
    queries.execute("""
      UPDATE inspection_treatment_followup SET verified_by_user_id = ?, verified_at = ?, outcome = ?,
        verification_notes = ?, version = version + 1 WHERE id = ?
      """, access.userId(), request.verifiedAt(), request.outcome().name(), request.notes().strip(), id);
    return get(inspectionId, id);
  }

  private Followup get(long inspectionId, long id) {
    return queries.select(SELECT + " WHERE f.inspection_id = ? AND f.id = ?", TreatmentFollowupService::map,
      inspectionId, id).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Seguimiento de tratamiento no encontrado"));
  }

  private void requireTransition(Followup followup, long version, Status expected) {
    if (followup.version() != version) throw conflict("El tratamiento cambió; actualiza su seguimiento");
    if (followup.status() != expected) throw conflict("El estado del tratamiento no permite esta acción");
  }

  private static Followup map(JpaSql.Row row) {
    Long treatmentId = row.value("treatment_id", Long.class);
    Instant verifiedAt = row.instant("verified_at");
    String outcome = row.text("outcome");
    Status status = Status.AUTHORIZED;
    if (treatmentId != null) status = Status.EXECUTED;
    if (verifiedAt != null) status = Status.VERIFIED;
    return new Followup(row.longValue("id"), row.longValue("inspection_id"), status,
      row.text("description"), row.text("product"), row.longValue("authorized_by_user_id"),
      row.text("authorized_by_name"), row.instant("authorized_at"), treatmentId, row.value("executed_by_user_id", Long.class),
      row.text("executed_by_name"), row.instant("executed_at"), row.text("product_lot"), row.value("quantity", Double.class),
      row.text("unit"), row.value("verified_by_user_id", Long.class), row.text("verified_by_name"), verifiedAt,
      outcome == null ? null : Outcome.valueOf(outcome), row.text("verification_notes"), row.longValue("version"));
  }

  private static String optionalText(String value) {
    return value == null || value.isBlank() ? null : value.strip();
  }

  private static ResponseStatusException badRequest(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }

  private static ResponseStatusException conflict(String message) {
    return new ResponseStatusException(HttpStatus.CONFLICT, message);
  }
}
