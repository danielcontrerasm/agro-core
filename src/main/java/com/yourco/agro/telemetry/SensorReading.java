package com.yourco.agro.telemetry;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "sensor_reading")
public class SensorReading {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "device_id") private SensorDevice device;
  @Column(name = "recorded_at", nullable = false) private Instant recordedAt;
  private Double soilMoisture;
  private Double airHumidity;
  private Double airTemperature;
  private Double soilTemperature;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public SensorDevice getDevice() { return device; }
  public void setDevice(SensorDevice value) { device = value; }
  public Instant getRecordedAt() { return recordedAt; }
  public void setRecordedAt(Instant value) { recordedAt = value; }
  public Double getSoilMoisture() { return soilMoisture; }
  public void setSoilMoisture(Double value) { soilMoisture = value; }
  public Double getAirHumidity() { return airHumidity; }
  public void setAirHumidity(Double value) { airHumidity = value; }
  public Double getAirTemperature() { return airTemperature; }
  public void setAirTemperature(Double value) { airTemperature = value; }
  public Double getSoilTemperature() { return soilTemperature; }
  public void setSoilTemperature(Double value) { soilTemperature = value; }
  public Instant getCreatedAt() { return createdAt; }
}
