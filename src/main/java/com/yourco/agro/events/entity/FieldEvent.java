package com.yourco.agro.events.entity;

import com.yourco.agro.farm.entity.Block;
import com.yourco.agro.farm.entity.RowLine;
import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name="field_event")
public class FieldEvent {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Column(name="event_type", nullable = false, columnDefinition = "event_type")
  private EventType eventType;

  @Column(name="occurred_at", nullable = false)
  private Instant occurredAt;

  @Column(name="created_by_user_id", nullable = false)
  private Long createdByUserId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name="block_id")
  private Block block;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name="row_id")
  private RowLine row;

  @Column(name="plant_index_start")
  private Integer plantIndexStart;

  @Column(name="plant_index_end")
  private Integer plantIndexEnd;

  @Column(columnDefinition = "geometry(Point,4326)")
  private Point geom;

  @Column(columnDefinition = "text")
  private String notes;

  @Column(nullable = false)
  private String status = "OPEN";

  @Column(name="created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public EventType getEventType() { return eventType; }
  public void setEventType(EventType eventType) { this.eventType = eventType; }

  public Instant getOccurredAt() { return occurredAt; }
  public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }

  public Long getCreatedByUserId() { return createdByUserId; }
  public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }

  public Block getBlock() { return block; }
  public void setBlock(Block block) { this.block = block; }

  public RowLine getRow() { return row; }
  public void setRow(RowLine row) { this.row = row; }

  public Integer getPlantIndexStart() { return plantIndexStart; }
  public void setPlantIndexStart(Integer plantIndexStart) { this.plantIndexStart = plantIndexStart; }

  public Integer getPlantIndexEnd() { return plantIndexEnd; }
  public void setPlantIndexEnd(Integer plantIndexEnd) { this.plantIndexEnd = plantIndexEnd; }

  public Point getGeom() { return geom; }
  public void setGeom(Point geom) { this.geom = geom; }

  public String getNotes() { return notes; }
  public void setNotes(String notes) { this.notes = notes; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
