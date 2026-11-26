package com.yourco.agro.inventory;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

import static com.yourco.agro.inventory.InventoryDtos.*;

@Service
public class InventoryService {
  private static final int MOVEMENT_PAGE_SIZE = 50;
  private static final int EXPIRY_NOTICE_DAYS = 30;
  private static final BigDecimal BALANCE_LIMIT = new BigDecimal("10000000000000");
  private static final BigDecimal COST_LIMIT = new BigDecimal("1000000000000");
  private static final String LOT_SELECT = """
    SELECT id, product_id, code, expires_on, balance, unit_cost_cop FROM inventory_lot WHERE farm_id = ?
    """;
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
    boolean viewCosts = access.canManage(farmId);
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
    var lots = queries.select(LOT_SELECT + " ORDER BY expires_on NULLS LAST, id", row -> lot(row, today, viewCosts), farmId);
    return new Overview(products, lots, movementPage(farmId, null, viewCosts));
  }

  public MovementPage movements(long farmId, Long beforeId) {
    access.require(farmId, false);
    return movementPage(farmId, beforeId, access.canManage(farmId));
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
        INSERT INTO inventory_lot (farm_id, product_id, code, expires_on, unit_cost_cop) VALUES (?, ?, ?, ?, ?)
        """, request.farmId(), productId, code, request.expiresOn(), request.unitCostCop());
      return new Lot(id, productId, code, request.expiresOn(), BigDecimal.ZERO, LotStatus.EMPTY,
        request.unitCostCop() != null, request.unitCostCop(), request.unitCostCop() != null ? BigDecimal.ZERO : null);
    } catch (DuplicateKeyException failure) {
      throw conflict("Ya existe un lote con ese código para el producto.");
    }
  }

  @Transactional
  public Lot updateLotCost(long lotId, UpdateLotCost request) {
    access.require(request.farmId(), true);
    int changed = queries.execute("UPDATE inventory_lot SET unit_cost_cop = ? WHERE farm_id = ? AND id = ?",
      request.unitCostCop(), request.farmId(), lotId);
    if (changed == 0) throw missingLot();
    return queries.selectOne(LOT_SELECT + " AND id = ?", row -> lot(row, LocalDate.now(ZoneOffset.UTC), true), request.farmId(), lotId);
  }

  @Transactional
  public Movement createMovement(CreateMovement request) {
    access.require(request.farmId(), true);
    var lot = lockLot(request.farmId(), request.lotId());
    return writeMovement(request, lot, null);
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public ApplicationConsumption consumeForApplication(long farmId, long lotId, UUID operationId, BigDecimal quantity,
                                                       String expectedProduct, String expectedUnit, LocalDate appliedOn, String reference) {
    access.require(farmId, false);
    if (quantity == null || quantity.signum() <= 0 || quantity.compareTo(BALANCE_LIMIT) >= 0 || quantity.stripTrailingZeros().scale() > 6) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica una cantidad aplicada positiva con hasta seis decimales.");
    }
    if (operationId == null || appliedOn == null || appliedOn.getYear() < 1 || appliedOn.getYear() > 9999) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica la fecha y el identificador de la aplicación.");
    }
    if (reference != null && reference.strip().length() > 180) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La referencia de la aplicación es demasiado larga.");
    }

    var lot = lockLot(farmId, lotId);
    var product = queries.selectOne("SELECT name, unit FROM inventory_product WHERE farm_id = ? AND id = ?",
      row -> new ProductIdentity(row.text("name"), row.text("unit")), farmId, lot.productId());
    if (expectedProduct != null && !textKey(expectedProduct).equals(textKey(product.name()))) {
      throw conflict("El producto del lote no coincide con el producto de la aplicación.");
    }
    if (expectedUnit != null && !unitKey(expectedUnit).equals(unitKey(product.unit()))) {
      throw conflict("La unidad del lote no coincide con la unidad aplicada.");
    }

    var request = new CreateMovement(farmId, lotId, operationId, Direction.OUT, quantity, reference, null);
    var saved = writeMovement(request, lot, appliedOn);
    return new ApplicationConsumption(saved.id(), product.name(), product.unit(), lot.code(), saved.unitCostCop(), saved.costCop());
  }

  private Lot lockLot(long farmId, long lotId) {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    return queries.select(LOT_SELECT + " AND id = ? FOR UPDATE", row -> lot(row, today, true), farmId, lotId)
      .stream().findFirst().orElseThrow(InventoryService::missingLot);
  }

  private Movement writeMovement(CreateMovement request, Lot lot, LocalDate appliedOn) {

    String reference = optionalText(request.reference());
    String notes = optionalText(request.notes());
    long author = access.userId();
    var alreadyRecorded = queries.select(MOVEMENT_SELECT + " WHERE m.farm_id = ? AND m.request_id = ?",
      row -> movement(row, true), request.farmId(), request.requestId()).stream().findFirst();
    if (alreadyRecorded.isPresent()) {
      Movement existing = alreadyRecorded.get();
      if (existing.lotId() == request.lotId() && existing.direction() == request.direction()
          && existing.createdByUserId() == author && existing.quantity().compareTo(request.quantity()) == 0
          && Objects.equals(existing.reference(), reference) && Objects.equals(existing.notes(), notes)
          && Objects.equals(existing.appliedOn(), appliedOn)) return existing;
      throw conflict("El identificador de solicitud ya corresponde a otro movimiento.");
    }

    BigDecimal updatedBalance = request.direction() == Direction.IN ? lot.balance().add(request.quantity()) : lot.balance().subtract(request.quantity());
    if (updatedBalance.signum() < 0) throw conflict("La cantidad supera las existencias del lote.");
    if (updatedBalance.compareTo(BALANCE_LIMIT) >= 0) throw conflict("La cantidad supera el saldo máximo del lote.");
    BigDecimal unitCost = null;
    BigDecimal cost = null;
    if (appliedOn != null) {
      if (lot.expiresOn() != null && lot.expiresOn().isBefore(appliedOn)) throw conflict("El lote estaba vencido en la fecha de la aplicación.");
      unitCost = lot.unitCostCop();
      if (unitCost == null) throw conflict("El lote no tiene costo unitario. Pide a un administrador o supervisor que lo registre en Inventario.");
      cost = unitCost.multiply(request.quantity()).setScale(2, RoundingMode.HALF_UP);
      if (cost.compareTo(COST_LIMIT) >= 0) throw conflict("El costo de la aplicación supera el valor máximo permitido.");
    }
    try {
      long id = queries.insert("""
        INSERT INTO inventory_movement (farm_id, lot_id, request_id, direction, quantity, balance_after, reference_label, notes,
          created_by_user_id, applied_on, unit_cost_cop, cost_cop)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, request.farmId(), request.lotId(), request.requestId(), request.direction().name(), request.quantity(), updatedBalance,
        reference, notes, author, appliedOn, unitCost, cost);
      queries.execute("UPDATE inventory_lot SET balance = ? WHERE farm_id = ? AND id = ?", updatedBalance, request.farmId(), request.lotId());
      return queries.selectOne(MOVEMENT_SELECT + " WHERE m.farm_id = ? AND m.id = ?", row -> movement(row, true), request.farmId(), id);
    } catch (DuplicateKeyException failure) {
      throw conflict("El identificador de solicitud ya corresponde a otro movimiento.");
    }
  }

  private MovementPage movementPage(long farmId, Long beforeId, boolean viewCosts) {
    var entries = beforeId == null
      ? queries.select(MOVEMENT_SELECT + " WHERE m.farm_id = ? ORDER BY m.id DESC LIMIT ?",
        row -> movement(row, viewCosts), farmId, MOVEMENT_PAGE_SIZE + 1)
      : queries.select(MOVEMENT_SELECT + " WHERE m.farm_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?",
        row -> movement(row, viewCosts), farmId, beforeId, MOVEMENT_PAGE_SIZE + 1);
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

  private static Lot lot(JpaSql.Row row, LocalDate today, boolean viewCosts) {
    BigDecimal balance = row.value("balance", BigDecimal.class);
    LocalDate expiresOn = row.date("expires_on");
    LotStatus status = LotStatus.AVAILABLE;
    if (balance.signum() == 0) status = LotStatus.EMPTY;
    else if (expiresOn != null) {
      if (expiresOn.isBefore(today)) status = LotStatus.EXPIRED;
      else if (!expiresOn.isAfter(today.plusDays(EXPIRY_NOTICE_DAYS))) status = LotStatus.EXPIRING;
    }
    BigDecimal unitCost = row.value("unit_cost_cop", BigDecimal.class);
    return new Lot(row.longValue("id"), row.longValue("product_id"), row.text("code"), expiresOn, balance, status,
      unitCost != null, viewCosts ? unitCost : null,
      viewCosts && unitCost != null ? balance.multiply(unitCost).setScale(2, RoundingMode.HALF_UP) : null);
  }

  private static Movement movement(JpaSql.Row row, boolean viewCosts) {
    return new Movement(row.longValue("id"), row.longValue("lot_id"), Direction.valueOf(row.text("direction")),
      row.value("quantity", BigDecimal.class), row.value("balance_after", BigDecimal.class), row.text("reference_label"),
      row.text("notes"), row.instant("created_at"), row.longValue("created_by_user_id"), row.text("created_by"),
      row.date("applied_on"), viewCosts ? row.value("unit_cost_cop", BigDecimal.class) : null,
      viewCosts ? row.value("cost_cop", BigDecimal.class) : null);
  }

  private static String textKey(String value) { return value.strip().replaceAll("(?U)\\s+", " ").toLowerCase(Locale.ROOT); }

  private static String unitKey(String value) {
    String key = textKey(value);
    return switch (key) {
      case "kg", "kgs", "kilogramo", "kilogramos" -> "kg";
      case "l", "lt", "lts", "litro", "litros" -> "l";
      default -> key;
    };
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

  private static ResponseStatusException missingLot() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontró el lote en la finca.");
  }

  private record ProductIdentity(String name, String unit) {}
}
