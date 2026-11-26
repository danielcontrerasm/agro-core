package com.yourco.agro.auth;

import com.yourco.agro.persistence.JpaSql;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class UserService {
  private final AppUserRepository users;
  private final JpaSql queries;
  private final PasswordEncoder passwords;
  private final String dummyHash;

  public UserService(AppUserRepository users, JpaSql queries, PasswordEncoder passwords) {
    this.users = users;
    this.queries = queries;
    this.passwords = passwords;
    this.dummyHash = passwords.encode("unused-password-for-timing");
  }

  public AuthDtos.User register(AuthDtos.RegisterRequest request) {
    String email = normalizeEmail(request.email());
    if (request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password exceeds 72 UTF-8 bytes");
    }
    try {
      return users.saveAndFlush(new AppUser(request.name().trim(), email, passwords.encode(request.password()))).toDto();
    } catch (DataIntegrityViolationException exception) {
      if (exception.getCause() instanceof ConstraintViolationException constraint && "23505".equals(constraint.getSQLState())) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
      }
      throw exception;
    }
  }

  public AuthDtos.User authenticate(AuthDtos.LoginRequest request) {
    var user = users.findByEmail(normalizeEmail(request.email()));
    boolean valid = passwords.matches(request.password(), user.map(AppUser::passwordHash).orElse(dummyHash));
    if (!valid || user.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
    return user.orElseThrow().toDto();
  }

  public AuthDtos.User findByEmail(String email) {
    return users.findByEmail(normalizeEmail(email)).map(AppUser::toDto)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
  }

  public AuthDtos.Profile profile(AuthDtos.User user) {
    var memberships = queries.select("""
      SELECT m.farm_id, f.name, m.role FROM farm_membership m
      JOIN farm f ON f.id = m.farm_id WHERE m.user_id = ? ORDER BY f.name, f.id
      """, result -> new AuthDtos.Membership(result.longValue("farm_id"),
        result.text("name"), AuthDtos.Role.valueOf(result.text("role"))), user.id());
    return new AuthDtos.Profile(user, memberships);
  }

  private String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
