package com.yourco.agro.workforce;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import com.yourco.agro.workforce.WorkforceDtos.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class WorkforceService {
  private static final String ATTENDANCE = """
    SELECT a.id, a.user_id, u.name AS user_name, a.attendance_date, a.status, a.hours, a.notes, a.version
    FROM workforce_attendance a JOIN app_user u ON u.id = a.user_id
    """;
  private static final Set<String> MANAGERS = Set.of("ADMIN", "SUPERVISOR");
  private final JpaSql queries;
  private final FarmAccess access;

  public WorkforceService(JpaSql queries, FarmAccess access) {
    this.queries = queries;
    this.access = access;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Workforce get(long farmId, LocalDate date) {
    long userId = access.userId();
    String role = queries.values("SELECT role FROM farm_membership WHERE farm_id=? AND user_id=?",
      String.class, farmId, userId).stream().findFirst()
      .orElseThrow(() -> failure(HttpStatus.FORBIDDEN, "No tienes acceso a esta finca."));
    boolean manager = MANAGERS.contains(role);

    var memberships = new HashMap<Long, List<Long>>();
    for (var row : queries.rows("""
      SELECT crew_id, user_id FROM workforce_crew_member
      WHERE farm_id=? AND (? OR user_id=?) ORDER BY user_id
      """, farmId, manager, userId)) {
      long crewId = JpaSql.convert(row.get("crew_id"), Long.class);
      memberships.computeIfAbsent(crewId, ignored -> new ArrayList<>()).add(JpaSql.convert(row.get("user_id"), Long.class));
    }
    var crews = queries.select("SELECT id, name, version FROM workforce_crew WHERE farm_id=? ORDER BY name, id",
      row -> new Crew(row.longValue("id"), row.text("name"), memberships.getOrDefault(row.longValue("id"), List.of()),
        row.intValue("version")), farmId).stream().filter(crew -> manager || !crew.memberIds().isEmpty()).toList();
    var attendance = queries.select(ATTENDANCE + """
      WHERE a.farm_id=? AND a.attendance_date=? AND (? OR a.user_id=?) ORDER BY u.name, a.user_id
      """, WorkforceService::attendance, farmId, date, manager, userId);
    return new Workforce(crews, attendance);
  }

  @Transactional
  public Crew createCrew(CreateCrew request) {
    long farmId = request.farmId();
    access.require(farmId, true);
    lockFarm(farmId);
    var memberIds = validateCrewMembers(farmId, 0, request.memberIds());
    String name = request.name().strip();
    long id;
    try {
      id = queries.insert("INSERT INTO workforce_crew (farm_id, name, name_key) VALUES (?, ?, ?)",
        farmId, name, name.toLowerCase(Locale.ROOT));
    } catch (DuplicateKeyException exception) {
      throw failure(HttpStatus.CONFLICT, "Ya existe una cuadrilla con ese nombre.");
    }
    addCrewMembers(farmId, id, memberIds);
    return new Crew(id, name, memberIds, 0);
  }

  @Transactional
  public Crew updateCrew(long id, UpdateCrew request) {
    long farmId = recordFarm("SELECT farm_id FROM workforce_crew WHERE id=?", id);
    access.require(farmId, true);
    lockFarm(farmId);
    var memberIds = validateCrewMembers(farmId, id, request.memberIds());
    String name = request.name().strip();
    try {
      int updated = queries.execute("""
        UPDATE workforce_crew SET name=?, name_key=?, version=version+1 WHERE id=? AND version=?
        """, name, name.toLowerCase(Locale.ROOT), id, request.version());
      requireUpdated(updated, "La cuadrilla cambió. Actualiza los datos antes de volver a editarla.");
    } catch (DuplicateKeyException exception) {
      throw failure(HttpStatus.CONFLICT, "Ya existe una cuadrilla con ese nombre.");
    }
    queries.execute("DELETE FROM workforce_crew_member WHERE farm_id=? AND crew_id=?", farmId, id);
    addCrewMembers(farmId, id, memberIds);
    return new Crew(id, name, memberIds, request.version() + 1);
  }

  @Transactional
  public Attendance createAttendance(CreateAttendance request) {
    long farmId = request.farmId();
    access.require(farmId, true);
    validateHours(request.status(), request.hours());
    var members = queries.values("SELECT user_id FROM farm_membership WHERE farm_id=? AND user_id=? FOR UPDATE",
      Long.class, farmId, request.userId());
    if (members.isEmpty()) throw failure(HttpStatus.BAD_REQUEST, "La persona debe pertenecer a la finca.");

    long id;
    try {
      long actor = access.userId();
      id = queries.insert("""
        INSERT INTO workforce_attendance (farm_id, user_id, attendance_date, status, hours, notes, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, farmId, request.userId(), request.date(), request.status().name(), request.hours(), notes(request.notes()), actor, actor);
    } catch (DuplicateKeyException exception) {
      throw failure(HttpStatus.CONFLICT, "Ya hay asistencia registrada para esta persona y fecha.");
    }
    return getAttendance(id);
  }

  @Transactional
  public Attendance updateAttendance(long id, UpdateAttendance request) {
    long farmId = recordFarm("SELECT farm_id FROM workforce_attendance WHERE id=?", id);
    access.require(farmId, true);
    validateHours(request.status(), request.hours());
    int updated = queries.execute("""
      UPDATE workforce_attendance SET status=?, hours=?, notes=?, updated_by=?, updated_at=CURRENT_TIMESTAMP,
        version=version+1 WHERE id=? AND version=?
      """, request.status().name(), request.hours(), notes(request.notes()), access.userId(), id, request.version());
    requireUpdated(updated, "La asistencia cambió. Actualiza los datos antes de volver a editarla.");
    return getAttendance(id);
  }

  private void lockFarm(long farmId) {
    if (queries.values("SELECT id FROM farm WHERE id=? FOR UPDATE", Long.class, farmId).isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "No se encontró la finca.");
    }
  }

  private List<Long> validateCrewMembers(long farmId, long crewId, List<Long> requested) {
    var memberIds = requested.stream().distinct().sorted().toList();
    if (memberIds.isEmpty()) return memberIds;

    var farmMembers = new HashSet<>(queries.values("SELECT user_id FROM farm_membership WHERE farm_id=?", Long.class, farmId));
    if (!farmMembers.containsAll(memberIds)) {
      throw failure(HttpStatus.BAD_REQUEST, "Todos los integrantes deben pertenecer a la finca.");
    }
    var assigned = new HashSet<>(queries.values("SELECT user_id FROM workforce_crew_member WHERE farm_id=? AND crew_id<>?",
      Long.class, farmId, crewId));
    if (memberIds.stream().anyMatch(assigned::contains)) {
      throw failure(HttpStatus.CONFLICT, "Un integrante ya pertenece a otra cuadrilla de esta finca.");
    }
    return memberIds;
  }

  private void addCrewMembers(long farmId, long crewId, List<Long> memberIds) {
    for (long userId : memberIds) {
      queries.execute("INSERT INTO workforce_crew_member (farm_id, crew_id, user_id) VALUES (?, ?, ?)", farmId, crewId, userId);
    }
  }

  private long recordFarm(String sql, long id) {
    return queries.values(sql, Long.class, id).stream().findFirst()
      .orElseThrow(() -> failure(HttpStatus.NOT_FOUND, "No se encontró el registro solicitado."));
  }

  private Attendance getAttendance(long id) {
    return queries.selectOne(ATTENDANCE + " WHERE a.id=?", WorkforceService::attendance, id);
  }

  private static Attendance attendance(JpaSql.Row row) {
    return new Attendance(row.longValue("id"), row.longValue("user_id"), row.text("user_name"), row.date("attendance_date"),
      AttendanceStatus.valueOf(row.text("status")), row.value("hours", BigDecimal.class), row.text("notes"), row.intValue("version"));
  }

  private static void validateHours(AttendanceStatus status, BigDecimal hours) {
    if ((status == AttendanceStatus.PRESENT) != (hours.signum() > 0)) {
      throw failure(HttpStatus.BAD_REQUEST, "Registra horas positivas para una asistencia y cero para una ausencia.");
    }
  }

  private static String notes(String notes) { return notes == null || notes.isBlank() ? null : notes.strip(); }

  private static void requireUpdated(int updated, String message) {
    if (updated == 0) throw failure(HttpStatus.CONFLICT, message);
  }

  private static ResponseStatusException failure(HttpStatus status, String message) {
    return new ResponseStatusException(status, message);
  }
}
