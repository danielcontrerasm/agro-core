package com.yourco.agro.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final UserService users;

  public AuthController(UserService users) { this.users = users; }

  @GetMapping("/csrf")
  public CsrfToken csrf(CsrfToken token) { return token; }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public AuthDtos.User register(@Valid @RequestBody AuthDtos.RegisterRequest request) {
    return users.register(request);
  }

  @PostMapping("/login")
  public AuthDtos.Profile login(@Valid @RequestBody AuthDtos.LoginRequest credentials,
                               HttpServletRequest request, HttpServletResponse response) {
    var user = users.authenticate(credentials);
    if (request.getSession(false) != null) request.changeSessionId();
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
    new CsrfAuthenticationStrategy(new HttpSessionCsrfTokenRepository())
      .onAuthentication(context.getAuthentication(), request, response);
    SecurityContextHolder.setContext(context);
    new HttpSessionSecurityContextRepository().saveContext(context, request, response);
    return users.profile(user);
  }

  @GetMapping("/me")
  public AuthDtos.Profile me(@AuthenticationPrincipal AuthDtos.User user) {
    return users.profile(user);
  }
}
