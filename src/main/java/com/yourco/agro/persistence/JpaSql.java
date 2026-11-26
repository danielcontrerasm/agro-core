package com.yourco.agro.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.PersistenceException;
import jakarta.persistence.Query;
import jakarta.persistence.Tuple;
import org.hibernate.dialect.H2Dialect;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.TypeMismatchDataAccessException;
import org.springframework.dao.support.DataAccessUtils;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedCaseInsensitiveMap;
import org.springframework.util.NumberUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

@Repository
public class JpaSql {
  @PersistenceContext
  private EntityManager entityManager;

  public List<Map<String, Object>> rows(String sql, Object... parameters) {
    return select(sql, Row::columns, parameters);
  }

  public Map<String, Object> row(String sql, Object... parameters) {
    return selectOne(sql, Row::columns, parameters);
  }

  public <T> T selectOne(String sql, Function<Row, T> projection, Object... parameters) {
    return DataAccessUtils.requiredSingleResult(select(sql, projection, parameters));
  }

  public <T> List<T> select(String sql, Function<Row, T> projection, Object... parameters) {
    List<?> results = bind(entityManager.createNativeQuery(sql, Tuple.class), parameters).getResultList();
    return results.stream().map(result -> projection.apply(toRow((Tuple) result))).toList();
  }

  public <T> List<T> values(String sql, Class<T> type, Object... parameters) {
    List<?> results = bind(entityManager.createNativeQuery(sql), parameters).getResultList();
    return results.stream().map(value -> convert(value, type)).toList();
  }

  public <T> T value(String sql, Class<T> type, Object... parameters) {
    return DataAccessUtils.nullableSingleResult(values(sql, type, parameters));
  }

  @Transactional
  public int execute(String sql, Object... parameters) {
    try {
      return bind(entityManager.createNativeQuery(sql), parameters).executeUpdate();
    } catch (PersistenceException exception) {
      throw translateWriteFailure(exception);
    }
  }

  @Transactional
  public long insert(String sql, Object... parameters) {
    var factory = entityManager.getEntityManagerFactory().unwrap(SessionFactoryImplementor.class);
    var dialect = factory.getJdbcServices().getDialect();
    // H2 exposes generated values through a data-change delta table.
    String insert = sql.stripTrailing();
    String returning = dialect instanceof H2Dialect
      ? "SELECT id FROM FINAL TABLE (" + insert + ")"
      : insert + " RETURNING id";
    try {
      Object id = bind(entityManager.createNativeQuery(returning), parameters).getSingleResult();
      return convert(id, Long.class);
    } catch (PersistenceException exception) {
      throw translateWriteFailure(exception);
    }
  }

  private Query bind(Query query, Object[] parameters) {
    for (int index = 0; index < parameters.length; index++) {
      query.setParameter(index + 1, parameters[index]);
    }
    return query;
  }

  private Row toRow(Tuple tuple) {
    Map<String, Object> columns = new LinkedCaseInsensitiveMap<>(tuple.getElements().size(), Locale.ROOT);
    tuple.getElements().forEach(column ->
      columns.put(column.getAlias().toLowerCase(Locale.ROOT), tuple.get(column)));
    return new Row(columns);
  }

  private RuntimeException translateWriteFailure(PersistenceException exception) {
    if (exception instanceof ConstraintViolationException constraint && "23505".equals(constraint.getSQLState())) {
      return new DuplicateKeyException("Unique constraint violated", exception);
    }
    return exception;
  }

  public static <T> T convert(Object value, Class<T> type) {
    if (value == null || type.isInstance(value)) return type.cast(value);
    if (value instanceof Number number && Number.class.isAssignableFrom(type)) {
      return type.cast(NumberUtils.convertNumberToTargetClass(number, type.asSubclass(Number.class)));
    }
    if (type == String.class) return type.cast(value.toString());
    if (type == LocalDate.class && value instanceof java.sql.Date date) return type.cast(date.toLocalDate());
    if (type == LocalTime.class && value instanceof java.sql.Time time) return type.cast(time.toLocalTime());
    if (type == Instant.class && value instanceof java.sql.Timestamp timestamp) return type.cast(timestamp.toInstant());
    if (type == Instant.class && value instanceof OffsetDateTime timestamp) return type.cast(timestamp.toInstant());
    throw new TypeMismatchDataAccessException("Cannot map " + value.getClass().getName() + " to " + type.getName());
  }

  public record Row(Map<String, Object> columns) {
    public <T> T value(String name, Class<T> type) { return convert(columns.get(name), type); }
    public String text(String name) { return value(name, String.class); }
    public long longValue(String name) { return value(name, Long.class); }
    public int intValue(String name) { return value(name, Integer.class); }
    public double doubleValue(String name) { return value(name, Double.class); }
    public boolean booleanValue(String name) { return Boolean.TRUE.equals(value(name, Boolean.class)); }
    public LocalDate date(String name) { return value(name, LocalDate.class); }
    public LocalTime time(String name) { return value(name, LocalTime.class); }
    public Instant instant(String name) { return value(name, Instant.class); }
  }
}
