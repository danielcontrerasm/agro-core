package com.yourco.agro.auth;

import jakarta.validation.Valid;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/v1/farms/{farmId}/members")
public class MembershipController {
  private final FarmAccess access;
  private final UserService users;
  private final JdbcTemplate jdbc;

  public MembershipController(FarmAccess access, UserService users, JdbcTemplate jdbc) {
    this.access = access;
    this.users = users;
    this.jdbc = jdbc;
  }

  @GetMapping
  public List<AuthDtos.Member> list(@PathVariable Long farmId) {
    access.require(farmId, true);
    return jdbc.query("""
      SELECT u.id, u.name, u.email, m.role FROM farm_membership m
      JOIN app_user u ON u.id = m.user_id WHERE m.farm_id = ? ORDER BY u.name, u.id
      """, (result, rowNumber) -> new AuthDtos.Member(result.getLong("id"), result.getString("name"),
        result.getString("email"), AuthDtos.Role.valueOf(result.getString("role"))), farmId);
  }

  @PutMapping
  public AuthDtos.Member assign(@PathVariable Long farmId, @Valid @RequestBody AuthDtos.MemberRequest request) {
    access.requireAdmin(farmId);
    var user = users.findByEmail(request.email());
    if (user.id().equals(access.userId()) && request.role() != AuthDtos.Role.ADMIN) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot demote yourself");
    }
    jdbc.update("""
      INSERT INTO farm_membership (farm_id, user_id, role) VALUES (?, ?, ?)
      ON CONFLICT (farm_id, user_id) DO UPDATE SET role = EXCLUDED.role
      """, farmId, user.id(), request.role().name());
    return new AuthDtos.Member(user.id(), user.name(), user.email(), request.role());
  }
}
