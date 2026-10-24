package com.yourco.agro.telemetry;

import com.yourco.agro.farm.entity.Block;
import com.yourco.agro.farm.entity.Farm;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "sensor_device")
public class SensorDevice {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "farm_id") private Farm farm;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "block_id") private Block block;
  @Column(nullable = false) private String name;
  @Column(name = "device_key", nullable = false, unique = true) private String deviceKey;
  @Column(nullable = false) private boolean active = true;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Farm getFarm() { return farm; }
  public void setFarm(Farm value) { farm = value; }
  public Block getBlock() { return block; }
  public void setBlock(Block value) { block = value; }
  public String getName() { return name; }
  public void setName(String value) { name = value; }
  public String getDeviceKey() { return deviceKey; }
  public void setDeviceKey(String value) { deviceKey = value; }
  public boolean isActive() { return active; }
  public void setActive(boolean value) { active = value; }
  public Instant getCreatedAt() { return createdAt; }
}
