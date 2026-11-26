package com.yourco.agro.finances;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Objects;

import static com.yourco.agro.finances.FinanceDtos.*;

@Service
public class FinanceService {
  private static final String ENTRY_SELECT = """
    SELECT e.id, e.farm_id, e.entry_date, e.entry_type, e.category, e.amount, e.description, e.field_id,
           f.name AS field_name, e.block_id, b.code AS block_code, e.version
      FROM farm_financial_entry e
      LEFT JOIN field f ON f.id = e.field_id
      LEFT JOIN block b ON b.id = e.block_id
    """;
  private static final Balance ZERO = new Balance(BigDecimal.ZERO, BigDecimal.ZERO);

  private final JpaSql queries;
  private final FarmAccess access;

  public FinanceService(JpaSql queries, FarmAccess access) {
    this.queries = queries;
    this.access = access;
  }

  @Transactional(readOnly = true)
  public Month month(long farmId, String period) {
    access.requireAdmin(farmId);
    var month = parseMonth(period);
    var entries = queries.select(ENTRY_SELECT + """
      WHERE e.farm_id = ? AND e.entry_date >= ? AND e.entry_date < ? ORDER BY e.entry_date DESC, e.id DESC
      """, FinanceService::projectEntry, farmId, month.atDay(1), month.plusMonths(1).atDay(1));
    var totals = ZERO;
    var categories = new EnumMap<Category, BigDecimal>(Category.class);
    var blocks = new LinkedHashMap<BlockRef, Balance>();
    for (var entry : entries) {
      totals = totals.add(entry);
      if (entry.type() == EntryType.EXPENSE) categories.merge(entry.category(), entry.amount(), BigDecimal::add);
      if (entry.blockId() != null) {
        var block = new BlockRef(entry.blockId(), entry.blockCode(), entry.fieldName());
        blocks.compute(block, (key, value) -> (value == null ? ZERO : value).add(entry));
      }
    }
    var categoryTotals = categories.entrySet().stream()
      .map(item -> new CategoryTotal(item.getKey(), item.getValue())).toList();
    var blockMargins = blocks.entrySet().stream().map(item -> {
      var block = item.getKey();
      var balance = item.getValue();
      return new BlockMargin(block.id(), block.code(), block.fieldName(), balance.expenses(), balance.income(), balance.margin());
    }).toList();
    return new Month(farmId, period, "COP", new Totals(totals.expenses(), totals.income(), totals.margin(), entries.size()),
      budget(farmId, month), categoryTotals, blockMargins, entries);
  }

  @Transactional
  public Entry createEntry(CreateEntry request) {
    long farmId = request.farmId();
    access.requireAdmin(farmId);
    lockFarm(farmId);
    var entry = request.entry();
    var fieldId = validateEntry(farmId, entry);
    var previous = queries.values("SELECT id FROM farm_financial_entry WHERE farm_id = ? AND operation_id = ?",
      Long.class, farmId, request.operationId());
    if (!previous.isEmpty()) {
      var saved = entry(farmId, previous.get(0));
      if (!sameEntry(saved, entry, fieldId)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya se registró un movimiento con este envío. Actualiza el periodo para consultar el movimiento guardado.");
      }
      return saved;
    }

    long userId = access.userId();
    long id = queries.insert("""
      INSERT INTO farm_financial_entry(farm_id, field_id, block_id, operation_id, entry_date, entry_type,
        category, amount, description, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """, farmId, fieldId, entry.blockId(), request.operationId(), entry.entryDate(), entry.type().name(),
      entry.category().name(), entry.amount(), entry.description().trim(), userId, userId);
    return entry(farmId, id);
  }

  @Transactional
  public Entry updateEntry(long id, UpdateEntry request) {
    long farmId = request.farmId();
    access.requireAdmin(farmId);
    var entry = request.entry();
    var fieldId = validateEntry(farmId, entry);
    int updated = queries.execute("""
      UPDATE farm_financial_entry SET field_id = ?, block_id = ?, entry_date = ?, entry_type = ?, category = ?,
        amount = ?, description = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP, version = version + 1
      WHERE farm_id = ? AND id = ? AND version = ?
      """, fieldId, entry.blockId(), entry.entryDate(), entry.type().name(), entry.category().name(), entry.amount(),
      entry.description().trim(), access.userId(), farmId, id, request.version());
    var saved = entry(farmId, id);
    if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "El movimiento cambió. Cierra el formulario y actualiza el periodo antes de editarlo de nuevo.");
    return saved;
  }

  @Transactional
  public Budget saveBudget(SaveBudget request) {
    long farmId = request.farmId();
    access.requireAdmin(farmId);
    var month = parseMonth(request.month());
    var start = month.atDay(1);
    lockFarm(farmId);
    long userId = access.userId();
    int updated = queries.execute("""
      UPDATE farm_monthly_budget SET amount = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE farm_id = ? AND period_start = ?
      """, request.amount(), userId, farmId, start);
    if (updated == 0) {
      queries.execute("INSERT INTO farm_monthly_budget(farm_id, period_start, amount, updated_by) VALUES (?, ?, ?, ?)",
        farmId, start, request.amount(), userId);
    }
    return budget(farmId, month);
  }

  private Long validateEntry(long farmId, EntryData entry) {
    if (entry.entryDate().getYear() < 1 || entry.entryDate().getYear() > 9999) {
      throw badRequest("La fecha del movimiento es inválida.");
    }
    if (!entry.category().allows(entry.type())) throw badRequest("La categoría no corresponde al tipo de movimiento.");

    Long fieldId = entry.fieldId();
    if (entry.blockId() != null) {
      var fields = queries.values("""
        SELECT b.field_id FROM block b JOIN field f ON f.id = b.field_id WHERE b.id = ? AND f.farm_id = ?
        """, Long.class, entry.blockId(), farmId);
      if (fields.isEmpty()) throw badRequest("Selecciona un bloque de esta finca.");
      Long blockFieldId = fields.get(0);
      if (fieldId != null && !fieldId.equals(blockFieldId)) throw badRequest("El bloque no pertenece al campo seleccionado.");
      return blockFieldId;
    }
    if (fieldId != null && queries.values("SELECT id FROM field WHERE id = ? AND farm_id = ?", Long.class, fieldId, farmId).isEmpty()) {
      throw badRequest("Selecciona un campo de esta finca.");
    }
    return fieldId;
  }

  private void lockFarm(long farmId) {
    if (queries.values("SELECT id FROM farm WHERE id = ? FOR UPDATE", Long.class, farmId).isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Finca no encontrada.");
    }
  }

  private Entry entry(long farmId, long id) {
    return queries.select(ENTRY_SELECT + "WHERE e.farm_id = ? AND e.id = ?", FinanceService::projectEntry, farmId, id)
      .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movimiento no encontrado."));
  }

  private Budget budget(long farmId, YearMonth month) {
    return queries.select("SELECT amount, updated_at FROM farm_monthly_budget WHERE farm_id = ? AND period_start = ?",
      row -> new Budget(row.value("amount", BigDecimal.class), row.instant("updated_at")), farmId, month.atDay(1))
      .stream().findFirst().orElse(null);
  }

  private static Entry projectEntry(JpaSql.Row row) {
    return new Entry(row.longValue("id"), row.longValue("farm_id"), row.date("entry_date"),
      EntryType.valueOf(row.text("entry_type")), Category.valueOf(row.text("category")), row.value("amount", BigDecimal.class),
      row.text("description"), row.value("field_id", Long.class), row.text("field_name"),
      row.value("block_id", Long.class), row.text("block_code"), row.longValue("version"));
  }

  private static boolean sameEntry(Entry saved, EntryData request, Long fieldId) {
    return saved.entryDate().equals(request.entryDate()) && saved.type() == request.type() && saved.category() == request.category()
      && saved.amount().compareTo(request.amount()) == 0 && saved.description().equals(request.description().trim())
      && Objects.equals(saved.fieldId(), fieldId) && Objects.equals(saved.blockId(), request.blockId());
  }

  private static YearMonth parseMonth(String month) {
    if (!month.matches("[0-9]{4}-(0[1-9]|1[0-2])") || month.startsWith("0000")) {
      throw badRequest("Indica un periodo mensual válido.");
    }
    return YearMonth.parse(month);
  }

  private static ResponseStatusException badRequest(String reason) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
  }

  private record BlockRef(long id, String code, String fieldName) {}

  private record Balance(BigDecimal expenses, BigDecimal income) {
    private Balance add(Entry entry) {
      return entry.type() == EntryType.EXPENSE ? new Balance(expenses.add(entry.amount()), income)
        : new Balance(expenses, income.add(entry.amount()));
    }

    private BigDecimal margin() { return income.subtract(expenses); }
  }
}
