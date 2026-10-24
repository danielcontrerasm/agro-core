package com.yourco.agro.telemetry;

import com.yourco.agro.farm.entity.Block;
import com.yourco.agro.farm.entity.Farm;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "alert_rule")
public class AlertRule {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "farm_id") private Farm farm;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "block_id") private Block block;
  @Enumerated(EnumType.STRING) @Column(nullable = false) private TelemetryMetric metric;
  @Column(nullable = false) private String operator;
  @Column(nullable = false) private Double threshold;
  @Column(nullable = false) private String severity;
  @Column(nullable = false) private String message;
  @Column(nullable = false) private boolean active = true;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Farm getFarm() { return farm; }
  public void setFarm(Farm value) { farm = value; }
  public Block getBlock() { return block; }
  public void setBlock(Block value) { block = value; }
  public TelemetryMetric getMetric() { return metric; }
  public void setMetric(TelemetryMetric value) { metric = value; }
  public String getOperator() { return operator; }
  public void setOperator(String value) { operator = value; }
  public Double getThreshold() { return threshold; }
  public void setThreshold(Double value) { threshold = value; }
  public String getSeverity() { return severity; }
  public void setSeverity(String value) { severity = value; }
  public String getMessage() { return message; }
  public void setMessage(String value) { message = value; }
  public boolean isActive() { return active; }
  public void setActive(boolean value) { active = value; }
}
