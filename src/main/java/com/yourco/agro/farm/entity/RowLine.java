package com.yourco.agro.farm.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.LineString;
import java.time.Instant;

@Entity
@Table(name="row_line",
  uniqueConstraints = @UniqueConstraint(name="uk_row_block_code", columnNames={"block_id","row_code"})
)
public class RowLine {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name="block_id")
  private Block block;

  @Column(name="row_code", nullable = false)
  private String rowCode;

  @Column(columnDefinition = "geometry(LineString,4326)", nullable = false)
  private LineString geom;

  @Column(name="length_m")
  private Double lengthM;

  @Column(name="plant_spacing_m")
  private Double plantSpacingM = 2.0;

  @Column(name="plants_estimated")
  private Integer plantsEstimated;

  @Column(name="created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public Block getBlock() { return block; }
  public void setBlock(Block block) { this.block = block; }

  public String getRowCode() { return rowCode; }
  public void setRowCode(String rowCode) { this.rowCode = rowCode; }

  public LineString getGeom() { return geom; }
  public void setGeom(LineString geom) { this.geom = geom; }

  public Double getLengthM() { return lengthM; }
  public void setLengthM(Double lengthM) { this.lengthM = lengthM; }

  public Double getPlantSpacingM() { return plantSpacingM; }
  public void setPlantSpacingM(Double plantSpacingM) { this.plantSpacingM = plantSpacingM; }

  public Integer getPlantsEstimated() { return plantsEstimated; }
  public void setPlantsEstimated(Integer plantsEstimated) { this.plantsEstimated = plantsEstimated; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
