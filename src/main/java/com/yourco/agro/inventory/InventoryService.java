package com.yourco.agro.inventory;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import static com.yourco.agro.inventory.InventoryDtos.*;

@Service
public class InventoryService {
  private static final int MOVEMENT_PAGE_SIZE = 50;
  private static final int EXPIRY_NOTICE_DAYS = 30;
  private static final BigDecimal BALANCE_LIMIT = new BigDecimal("10000000000000");
  private static final String MOVEMENT_SELECT = """
    SELECT m.*, u.name AS created_by
    FROM inventory_movement m JOIN app_user u ON u.id = m.created_by_user_id
    """;

  private final FarmAccess access;
  private final JpaSql queries;

  public InventoryService(FarmAccess access, JpaSql queries) {
    this.access = access;
    this.queries = queries;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Overview overview(long farmId) {
    access.require(farmId, false);
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    var products = queries.select("""
      SELECT p.id, p.code, p.name, p.category, p.unit, p.minimum,
        COALESCE(SUM(l.balance), 0) AS balance,
        COALESCE(SUM(CASE WHEN l.expires_on IS NULL OR l.expires_on >= ? THEN l.balance ELSE 0 END), 0) AS available
      FROM inventory_product p LEFT JOIN inventory_lot l ON l.product_id = p.id AND l.farm_id = p.farm_id
      WHERE p.farm_id = ?
      GROUP BY p.id, p.code, p.name, p.category, p.unit, p.minimum
      ORDER BY p.name, p.code, p.id
      """, InventoryService::product, today, farmId);
    var lots = queries.select("""
      SELECT id, product_id, code, expires_on, balance FROM inventory_lot WHERE farm_id = ?
      ORDER BY expires_on NULLS LAST, id
      """, row -> lot(row, today), farmId);
    return new Overview(products, lots, movementPage(farmId, null));
  }

  public MovementPage movements(long farmId, Long beforeId) {
    access.require(farmId, false);
    return movementPage(farmId, beforeId);
  }

  @Transactional
  public Product createProduct(CreateProduct request) {
    access.require(request.farmId(), true);
    String code = normalizeCode(request.code(), 60);
    String name = request.name().strip();
    String category = request.category().strip();
    String unit = request.unit().strip();
    try {
      long id = queries.insert("""
        INSERT INTO inventory_product (farm_id, code, name, category, unit, minimum)
        VALUES (?, ?, ?, ?, ?, ?)
        """, request.farmId(), code, name, category, unit, request.minimum());
      return new Product(id, code, name, category, unit, request.minimum(), BigDecimal.ZERO, BigDecimal.ZERO, request.minimum().signum() > 0);
    } catch (DuplicateKeyException failure) {
      throw conflict("Ya existe un producto con ese código en la finca.");
    }
  }

  @Transactional
  public Lot createLot(CreateLot request) {
    access.require(request.farmId(), true);
    Long productId = queries.values("SELECT id FROM inventory_product WHERE farm_id = ? AND id = ?",
      Long.class, request.farmId(), request.productId()).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontró el producto en la finca."));
    String code = normalizeCode(request.code(), 80);
    try {
      long id = queries.insert("""
        INSERT INTO inventory_lot (farm_id, product_id, code, expires_on) VALUES (?, ?, ?, ?)
        """, request.farmId(), productId, code, request.expiresOn());
      return new Lot(id, productId, code, request.expiresOn(), BigDecimal.ZERO, LotStatus.EMPTY);
    } catch (DuplicateKeyException failure) {
      throw conflict("Ya existe un lote con ese código para el producto.");
    }
  }

  @Transactional
  public Movement createMovement(CreateMovement request) {
    access.require(request.farmId(), true);
    var balance = queries.values("SELECT balance FROM inventory_lot WHERE farm_id = ? AND id = ? FOR UPDATE",
      BigDecimal.class, request.farmId(), request.lotId()).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontró el lote en la finca."));

    String reference = optionalText(request.reference());
    String notes = optionalText(request.notes());
    long author = access.userId();
    var alreadyRecorded = queries.select(MOVEMENT_SELECT + " WHERE m.farm_id = ? AND m.request_id = ?",
      InventoryService::movement, request.farmId(), request.requestId()).stream().findFirst();
    if (alreadyRecorded.isPresent()) {
      Movement existing = alreadyRecorded.get();
      if (existing.lotId() == request.lotId() && existing.direction() == request.direction()
          && existing.createdByUserId() == author && existing.quantity().compareTo(request.quantity()) == 0
          && Objects.equals(existing.reference(), reference) && Objects.equals(existing.notes(), notes)) return existing;
      throw conflict("El identificador de solicitud ya corresponde a otro movimiento.");
    }

    BigDecimal updatedBalance = request.direction() == Direction.IN ? balance.add(request.quantity()) : balance.subtract(request.quantity());
    if (updatedBalance.signum() < 0) throw conflict("La cantidad supera las existencias del lote.");
    if (updatedBalance.compareTo(BALANCE_LIMIT) >= 0) throw conflict("La cantidad supera el saldo máximo del lote.");
    try {
      long id = queries.insert("""
        INSERT INTO inventory_movement (farm_id, lot_id, request_id, direction, quantity, balance_after, reference_label, notes, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, request.farmId(), request.lotId(), request.requestId(), request.direction().name(), request.quantity(), updatedBalance, reference, notes, author);
      queries.execute("UPDATE inventory_lot SET balance = ? WHERE farm_id = ? AND id = ?", updatedBalance, request.farmId(), request.lotId());
      return queries.selectOne(MOVEMENT_SELECT + " WHERE m.farm_id = ? AND m.id = ?", InventoryService::movement, request.farmId(), id);
    } catch (DuplicateKeyException failure) {
      throw conflict("El identificador de solicitud ya corresponde a otro movimiento.");
    }
  }

  private MovementPage movementPage(long farmId, Long beforeId) {
    var entries = beforeId == null
      ? queries.select(MOVEMENT_SELECT + " WHERE m.farm_id = ? ORDER BY m.id DESC LIMIT ?",
        InventoryService::movement, farmId, MOVEMENT_PAGE_SIZE + 1)
      : queries.select(MOVEMENT_SELECT + " WHERE m.farm_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?",
        InventoryService::movement, farmId, beforeId, MOVEMENT_PAGE_SIZE + 1);
    if (entries.size() <= MOVEMENT_PAGE_SIZE) return new MovementPage(entries, null);
    List<Movement> page = entries.subList(0, MOVEMENT_PAGE_SIZE);
    return new MovementPage(page, page.get(page.size() - 1).id());
  }

  private static Product product(JpaSql.Row row) {
    BigDecimal minimum = row.value("minimum", BigDecimal.class);
    BigDecimal available = row.value("available", BigDecimal.class);
    return new Product(row.longValue("id"), row.text("code"), row.text("name"), row.text("category"), row.text("unit"),
      minimum, available, row.value("balance", BigDecimal.class), available.compareTo(minimum) < 0);
  }

  private static Lot lot(JpaSql.Row row, LocalDate today) {
    BigDecimal balance = row.value("balance", BigDecimal.class);
    LocalDate expiresOn = row.date("expires_on");
    LotStatus status = LotStatus.AVAILABLE;
    if (balance.signum() == 0) status = LotStatus.EMPTY;
    else if (expiresOn != null) {
      if (expiresOn.isBefore(today)) status = LotStatus.EXPIRED;
      else if (!expiresOn.isAfter(today.plusDays(EXPIRY_NOTICE_DAYS))) status = LotStatus.EXPIRING;
    }
    return new Lot(row.longValue("id"), row.longValue("product_id"), row.text("code"), expiresOn, balance, status);
  }

  private static Movement movement(JpaSql.Row row) {
    return new Movement(row.longValue("id"), row.longValue("lot_id"), Direction.valueOf(row.text("direction")),
      row.value("quantity", BigDecimal.class), row.value("balance_after", BigDecimal.class), row.text("reference_label"),
      row.text("notes"), row.instant("created_at"), row.longValue("created_by_user_id"), row.text("created_by"));
  }

  private static String normalizeCode(String code, int maximumLength) {
    String normalized = code.strip().toUpperCase(Locale.ROOT);
    if (normalized.isEmpty() || normalized.length() > maximumLength) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El código no tiene una longitud válida.");
    }
    return normalized;
  }

  private static String optionalText(String text) {
    if (text == null || text.isBlank()) return null;
    return text.strip();
  }

  private static ResponseStatusException conflict(String reason) {
    return new ResponseStatusException(HttpStatus.CONFLICT, reason);
  }
}
