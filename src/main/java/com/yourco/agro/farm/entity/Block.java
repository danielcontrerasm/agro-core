package com.yourco.agro.farm.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Polygon;
import java.time.Instant;

@Entity
@Table(name="block",
  uniqueConstraints = @UniqueConstraint(name="uk_block_field_code", columnNames={"field_id","code"})
)
public class Block {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name="field_id")
  private Field field;

  @Column(nullable = false)
  private String code;

  @Column(nullable = false)
  private String crop = "banana";

  @Column(name="crop_catalog_id")
  private Long cropId;

  @Column(name="variety_id")
  private Long varietyId;

  private String variety;

  @Column(columnDefinition = "geometry(Polygon,4326)", nullable = false)
  private Polygon geom;

  @Column(name="area_ha")
  private Double areaHa;

  @Column(name="created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public Field getField() { return field; }
  public void setField(Field field) { this.field = field; }

  public String getCode() { return code; }
  public void setCode(String code) { this.code = code; }

  public String getCrop() { return crop; }
  public void setCrop(String crop) { this.crop = crop; }

  public Long getCropId() { return cropId; }
  public void setCropId(Long cropId) { this.cropId = cropId; }

  public Long getVarietyId() { return varietyId; }
  public void setVarietyId(Long varietyId) { this.varietyId = varietyId; }

  public String getVariety() { return variety; }
  public void setVariety(String variety) { this.variety = variety; }

  public Polygon getGeom() { return geom; }
  public void setGeom(Polygon geom) { this.geom = geom; }

  public Double getAreaHa() { return areaHa; }
  public void setAreaHa(Double areaHa) { this.areaHa = areaHa; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
