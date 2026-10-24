package com.yourco.agro.planting;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.catalog.CropCatalogService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.yourco.agro.planting.PlantingCalendarDtos.*;

@Service
public class PlantingCalendarService {
  private static final String SELECT = """
    SELECT p.id, p.farm_id, p.region, p.crop_catalog_id, p.variety_id,
      c.name AS crop_name, v.name AS variety_name, p.season_name,
      p.window_from_month, p.window_from_day, p.window_to_month, p.window_to_day,
      p.perennial, p.preparation_lead_days, p.notes, p.active
    FROM planting_calendar p
    JOIN crop_catalog c ON c.id = p.crop_catalog_id
    LEFT JOIN crop_variety v ON v.id = p.variety_id
    WHERE p.id = ?
    """;

  private final JdbcTemplate jdbc;
  private final FarmAccess access;
  private final CropCatalogService catalog;

  public PlantingCalendarService(JdbcTemplate jdbc, FarmAccess access, CropCatalogService catalog) {
    this.jdbc = jdbc;
    this.access = access;
    this.catalog = catalog;
  }

  public List<CalendarRule> list(long farmId) {
    access.require(farmId, false);
    String query = SELECT.replace("WHERE p.id = ?", "WHERE p.farm_id = ? ORDER BY lower(p.region), p.season_name, p.id");
    return jdbc.query(query, (result, rowNumber) -> map(result), farmId);
  }

  public List<Suggestion> suggestions(long farmId, long cropId, Long varietyId, Integer year) {
    access.require(farmId, false);
    var selection = catalog.resolve(farmId, cropId, varietyId);
    String region = jdbc.queryForObject("SELECT region FROM farm WHERE id = ?", String.class, farmId);
    if (region == null || region.isBlank()) return List.of();
    int selectedYear = year == null ? LocalDate.now().getYear() : year;
    if (selectedYear < 1900 || selectedYear > 2200) throw bad("El año de consulta no es válido");
    return matchingRules(farmId, region, selection.cropId(), selection.varietyId()).stream()
      .filter(CalendarRule::active)
      .map(rule -> suggestion(rule, selectedYear))
      .toList();
  }

  @Transactional
  public CalendarRule create(CalendarRequest request) {
    access.requireAgronomic(request.farmId());
    validateWindow(request);
    var selection = catalog.resolve(request.farmId(), request.cropId(), request.varietyId());
    ensureUnique(request, null);
    long id = insert("""
      INSERT INTO planting_calendar(farm_id,region,crop_catalog_id,variety_id,season_name,
        window_from_month,window_from_day,window_to_month,window_to_day,perennial,
        preparation_lead_days,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      """, request.farmId(), normalizeRegion(request.region()), selection.cropId(), selection.varietyId(),
      request.seasonName().trim(), request.windowFromMonth(), request.windowFromDay(), request.windowToMonth(),
      request.windowToDay(), request.perennial(), request.preparationLeadDays(), request.notes(), access.userId());
    return get(id);
  }

  @Transactional
  public CalendarRule update(long id, CalendarRequest request) {
    var current = getRow(id);
    long farmId = ((Number) current.get("farm_id")).longValue();
    access.requireAgronomic(farmId);
    if (farmId != request.farmId()) throw bad("La regla no puede cambiar de finca");
    validateWindow(request);
    var selection = catalog.resolve(farmId, request.cropId(), request.varietyId());
    ensureUnique(request, id);
    jdbc.update("""
      UPDATE planting_calendar SET region=?,crop_catalog_id=?,variety_id=?,season_name=?,
        window_from_month=?,window_from_day=?,window_to_month=?,window_to_day=?,perennial=?,
        preparation_lead_days=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
      """, normalizeRegion(request.region()), selection.cropId(), selection.varietyId(), request.seasonName().trim(),
      request.windowFromMonth(), request.windowFromDay(), request.windowToMonth(), request.windowToDay(),
      request.perennial(), request.preparationLeadDays(), request.notes(), id);
    return get(id);
  }

  @Transactional
  public void deactivate(long id) {
    var current = getRow(id);
    access.requireAgronomic(((Number) current.get("farm_id")).longValue());
    jdbc.update("UPDATE planting_calendar SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=?", id);
  }

  public void validateCycleWindow(long farmId, Long cropId, Long varietyId, LocalDate from, LocalDate to) {
    if (cropId == null) return;
    if (to.isBefore(from)) throw bad("La ventana de siembra es inválida");
    var selection = catalog.resolve(farmId, cropId, varietyId);
    String region = jdbc.queryForObject("SELECT region FROM farm WHERE id = ?", String.class, farmId);
    if (region == null || region.isBlank()) return;
    var rules = matchingRules(farmId, region, selection.cropId(), selection.varietyId()).stream()
      .filter(CalendarRule::active).toList();
    if (rules.isEmpty() || rules.stream().anyMatch(CalendarRule::perennial)) return;
    if (rules.stream().noneMatch(rule -> coveredByRule(rule, from, to))) {
      throw bad("La ventana del ciclo está fuera del calendario regional configurado");
    }
  }

  private boolean coveredByRule(CalendarRule rule, LocalDate from, LocalDate to) {
    for (int year = from.getYear() - 1; year <= to.getYear() + 1; year++) {
      LocalDate windowFrom = recurringDate(year, rule.windowFromMonth(), rule.windowFromDay());
      int endYear = windowEndsNextYear(rule) ? year + 1 : year;
      LocalDate windowTo = recurringDate(endYear, rule.windowToMonth(), rule.windowToDay());
      if (!from.isBefore(windowFrom) && !to.isAfter(windowTo)) return true;
    }
    return false;
  }

  private boolean windowEndsNextYear(CalendarRule rule) {
    return rule.windowToMonth() < rule.windowFromMonth()
      || (rule.windowToMonth().equals(rule.windowFromMonth()) && rule.windowToDay() < rule.windowFromDay());
  }

  private Suggestion suggestion(CalendarRule rule, int year) {
    if (rule.perennial()) {
      return new Suggestion(rule.id(), rule.farmId(), rule.region(), rule.cropId(), rule.varietyId(), rule.crop(),
        rule.variety(), rule.seasonName(), null, null, true, rule.preparationLeadDays(), rule.notes());
    }
    LocalDate from = recurringDate(year, rule.windowFromMonth(), rule.windowFromDay());
    LocalDate to = recurringDate(windowEndsNextYear(rule) ? year + 1 : year, rule.windowToMonth(), rule.windowToDay());
    return new Suggestion(rule.id(), rule.farmId(), rule.region(), rule.cropId(), rule.varietyId(), rule.crop(),
      rule.variety(), rule.seasonName(), from, to, false, rule.preparationLeadDays(), rule.notes());
  }

  private LocalDate recurringDate(int year, Integer month, Integer day) {
    YearMonth yearMonth = YearMonth.of(year, month);
    return yearMonth.atDay(Math.min(day, yearMonth.lengthOfMonth()));
  }

  private List<CalendarRule> matchingRules(long farmId, String region, long cropId, Long varietyId) {
    String query = """
      SELECT p.id, p.farm_id, p.region, p.crop_catalog_id, p.variety_id,
        c.name AS crop_name, v.name AS variety_name, p.season_name,
        p.window_from_month, p.window_from_day, p.window_to_month, p.window_to_day,
        p.perennial, p.preparation_lead_days, p.notes, p.active
      FROM planting_calendar p
      JOIN crop_catalog c ON c.id = p.crop_catalog_id
      LEFT JOIN crop_variety v ON v.id = p.variety_id
      WHERE p.farm_id = ? AND lower(p.region) = lower(?) AND p.crop_catalog_id = ?
      """;
    if (varietyId == null) {
      query += " AND p.variety_id IS NULL ORDER BY p.id";
      return jdbc.query(query, (result, rowNumber) -> map(result), farmId, region, cropId);
    }
    query += " AND (p.variety_id = ? OR p.variety_id IS NULL) ORDER BY CASE WHEN p.variety_id = ? THEN 0 ELSE 1 END, p.id";
    return jdbc.query(query, (result, rowNumber) -> map(result), farmId, region, cropId, varietyId, varietyId);
  }

  private void ensureUnique(CalendarRequest request, Long ignoredId) {
    String query = "SELECT COUNT(*) FROM planting_calendar WHERE farm_id=? AND lower(region)=lower(?) AND crop_catalog_id=? AND lower(season_name)=lower(?)";
    Object[] values;
    if (request.varietyId() == null) {
      query += " AND variety_id IS NULL";
      values = new Object[]{request.farmId(), normalizeRegion(request.region()), request.cropId(), request.seasonName().trim()};
    } else {
      query += " AND variety_id=?";
      values = new Object[]{request.farmId(), normalizeRegion(request.region()), request.cropId(), request.seasonName().trim(), request.varietyId()};
    }
    if (ignoredId != null) {
      query += " AND id<>?";
      var expanded = Arrays.copyOf(values, values.length + 1);
      expanded[values.length] = ignoredId;
      values = expanded;
    }
    if (jdbc.queryForObject(query, Integer.class, values) > 0) throw conflict("Ya existe una regla con ese nombre para la región y cultivo");
  }

  private void validateWindow(CalendarRequest request) {
    if (Boolean.TRUE.equals(request.perennial())) return;
    try {
      LocalDate from = LocalDate.of(2024, request.windowFromMonth(), request.windowFromDay());
      LocalDate to = LocalDate.of(2024, request.windowToMonth(), request.windowToDay());
      if (from.equals(to)) throw bad("La ventana anual debe tener una duración mayor a cero");
    } catch (RuntimeException exception) {
      if (exception instanceof ResponseStatusException response) throw response;
      throw bad("La ventana anual contiene una fecha inválida");
    }
  }

  private CalendarRule get(long id) {
    return jdbc.query(SELECT, (result, rowNumber) -> map(result), id).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Regla de calendario no encontrada"));
  }

  private Map<String, Object> getRow(long id) {
    var rows = jdbc.queryForList("SELECT * FROM planting_calendar WHERE id=?", id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Regla de calendario no encontrada");
    return rows.get(0);
  }

  private CalendarRule map(ResultSet result) throws SQLException {
    return new CalendarRule(result.getLong("id"), result.getLong("farm_id"), result.getString("region"),
      result.getLong("crop_catalog_id"), result.getObject("variety_id", Long.class), result.getString("crop_name"),
      result.getString("variety_name"), result.getString("season_name"), integer(result, "window_from_month"),
      integer(result, "window_from_day"), integer(result, "window_to_month"), integer(result, "window_to_day"),
      result.getBoolean("perennial"), integer(result, "preparation_lead_days"), result.getString("notes"), result.getBoolean("active"));
  }

  private Integer integer(ResultSet result, String column) throws SQLException {
    Number value = (Number) result.getObject(column);
    return value == null ? null : value.intValue();
  }

  private long insert(String sql, Object... values) {
    var key = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      var statement = connection.prepareStatement(sql, new String[]{"id"});
      for (int index = 0; index < values.length; index++) statement.setObject(index + 1, values[index]);
      return statement;
    }, key);
    return Objects.requireNonNull(key.getKey()).longValue();
  }

  private String normalizeRegion(String value) { return value.trim(); }
  private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
  private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
