package com.yourco.agro.auth;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class UserService {
  private final JdbcTemplate jdbc;
  private final PasswordEncoder passwords;
  private final String dummyHash;

  public UserService(JdbcTemplate jdbc, PasswordEncoder passwords) {
    this.jdbc = jdbc;
    this.passwords = passwords;
    this.dummyHash = passwords.encode("unused-password-for-timing");
  }

  public AuthDtos.User register(AuthDtos.RegisterRequest request) {
    String email = normalizeEmail(request.email());
    if (request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password exceeds 72 UTF-8 bytes");
    }
    try {
      jdbc.update("INSERT INTO app_user (name, email, password_hash) VALUES (?, ?, ?)",
        request.name().trim(), email, passwords.encode(request.password()));
    } catch (DuplicateKeyException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
    }
    return findByEmail(email);
  }

  public AuthDtos.User authenticate(AuthDtos.LoginRequest request) {
    var hashes = jdbc.queryForList("SELECT password_hash FROM app_user WHERE email = ?",
      String.class, normalizeEmail(request.email()));
    boolean valid = passwords.matches(request.password(), hashes.isEmpty() ? dummyHash : hashes.get(0));
    if (!valid || hashes.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
    return findByEmail(request.email());
  }

  public AuthDtos.User findByEmail(String email) {
    return jdbc.query("SELECT id, name, email FROM app_user WHERE email = ?",
      (result, rowNumber) -> new AuthDtos.User(result.getLong("id"), result.getString("name"),
        result.getString("email")), normalizeEmail(email)).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
  }

  public AuthDtos.Profile profile(AuthDtos.User user) {
    var memberships = jdbc.query("""
      SELECT m.farm_id, f.name, m.role FROM farm_membership m
      JOIN farm f ON f.id = m.farm_id WHERE m.user_id = ? ORDER BY f.name, f.id
      """, (result, rowNumber) -> new AuthDtos.Membership(result.getLong("farm_id"),
        result.getString("name"), AuthDtos.Role.valueOf(result.getString("role"))), user.id());
    return new AuthDtos.Profile(user, memberships);
  }

  private String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
