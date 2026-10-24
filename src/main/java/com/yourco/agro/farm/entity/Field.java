package com.yourco.agro.farm.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Polygon;
import java.time.Instant;

@Entity
@Table(name="field")
public class Field {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name="farm_id")
  private Farm farm;

  @Column(nullable = false)
  private String name;

  @Column(columnDefinition = "geometry(Polygon,4326)", nullable = false)
  private Polygon geom;

  @Column(name="area_ha")
  private Double areaHa;

  @Column(name="created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public Farm getFarm() { return farm; }
  public void setFarm(Farm farm) { this.farm = farm; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public Polygon getGeom() { return geom; }
  public void setGeom(Polygon geom) { this.geom = geom; }

  public Double getAreaHa() { return areaHa; }
  public void setAreaHa(Double areaHa) { this.areaHa = areaHa; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
