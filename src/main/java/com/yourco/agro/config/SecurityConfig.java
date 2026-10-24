package com.yourco.agro.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
      .cors(Customizer.withDefaults())
      .authorizeHttpRequests(access -> access
        .requestMatchers(HttpMethod.GET, "/api/v1/auth/csrf", "/swagger-ui/**", "/v3/api-docs/**",
          "/swagger-ui.html", "/actuator/health").permitAll()
        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login").permitAll()
        .anyRequest().authenticated())
      .exceptionHandling(errors -> errors
        .authenticationEntryPoint((request, response, exception) -> response.sendError(401))
        .accessDeniedHandler((request, response, exception) -> response.sendError(403)))
      .logout(logout -> logout.logoutUrl("/api/v1/auth/logout")
        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
      .build();
  }
}
