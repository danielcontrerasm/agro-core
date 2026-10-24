package com.yourco.agro.farm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "farm")
public class Farm {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String name;

  private String country;
  private String region;

  @Column(name="created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public String getCountry() { return country; }
  public void setCountry(String country) { this.country = country; }

  public String getRegion() { return region; }
  public void setRegion(String region) { this.region = region; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
