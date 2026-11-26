package com.yourco.agro.auth;

import com.yourco.agro.persistence.JpaSql;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/v1/farms/{farmId}/members")
public class MembershipController {
  private final FarmAccess access;
  private final UserService users;
  private final JpaSql queries;

  public MembershipController(FarmAccess access, UserService users, JpaSql queries) {
    this.access = access;
    this.users = users;
    this.queries = queries;
  }

  @GetMapping
  public List<AuthDtos.Member> list(@PathVariable Long farmId) {
    access.require(farmId, true);
    return queries.select("""
      SELECT u.id, u.name, u.email, m.role FROM farm_membership m
      JOIN app_user u ON u.id = m.user_id WHERE m.farm_id = ? ORDER BY u.name, u.id
      """, result -> new AuthDtos.Member(result.longValue("id"), result.text("name"),
        result.text("email"), AuthDtos.Role.valueOf(result.text("role"))), farmId);
  }

  @PutMapping
  public AuthDtos.Member assign(@PathVariable Long farmId, @Valid @RequestBody AuthDtos.MemberRequest request) {
    access.requireAdmin(farmId);
    var user = users.findByEmail(request.email());
    if (user.id().equals(access.userId()) && request.role() != AuthDtos.Role.ADMIN) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot demote yourself");
    }
    queries.execute("""
      INSERT INTO farm_membership (farm_id, user_id, role) VALUES (?, ?, ?)
      ON CONFLICT (farm_id, user_id) DO UPDATE SET role = EXCLUDED.role
      """, farmId, user.id(), request.role().name());
    return new AuthDtos.Member(user.id(), user.name(), user.email(), request.role());
  }
}
