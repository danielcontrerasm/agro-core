package com.yourco.agro.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public class AuthDtos {
  public record RegisterRequest(
    @NotBlank @Size(max = 150) String name,
    @NotBlank @Email @Size(max = 254) String email,
    @NotBlank @Size(min = 12, max = 64) String password
  ) {}

  public record LoginRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(max = 64) String password
  ) {}

  public enum Role { ADMIN, SUPERVISOR, AGRONOMIST, WORKER }

  public record MemberRequest(@NotBlank @Email String email, @NotNull Role role) {}
  public record User(Long id, String name, String email) {}
  public record Membership(Long farmId, String farmName, Role role) {}
  public record Profile(User user, List<Membership> memberships) {}
  public record Member(Long userId, String name, String email, Role role) {}
}
