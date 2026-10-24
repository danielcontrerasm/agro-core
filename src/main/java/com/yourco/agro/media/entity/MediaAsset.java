package com.yourco.agro.media.entity;

import com.yourco.agro.events.entity.FieldEvent;
import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name="media_asset")
public class MediaAsset {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name="event_id")
  private FieldEvent event;

  @Column(nullable = false)
  private String kind;

  @Column(name="s3_key", nullable = false)
  private String s3Key;

  @Column(name="content_type")
  private String contentType;

  @Column(name="captured_at")
  private Instant capturedAt;

  @Column(name="gps_geom", columnDefinition = "geometry(Point,4326)")
  private Point gpsGeom;

  @Column(columnDefinition = "jsonb")
  @JdbcTypeCode(SqlTypes.JSON)
  private String meta;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public FieldEvent getEvent() { return event; }
  public void setEvent(FieldEvent event) { this.event = event; }

  public String getKind() { return kind; }
  public void setKind(String kind) { this.kind = kind; }

  public String getS3Key() { return s3Key; }
  public void setS3Key(String s3Key) { this.s3Key = s3Key; }

  public String getContentType() { return contentType; }
  public void setContentType(String contentType) { this.contentType = contentType; }

  public Instant getCapturedAt() { return capturedAt; }
  public void setCapturedAt(Instant capturedAt) { this.capturedAt = capturedAt; }

  public Point getGpsGeom() { return gpsGeom; }
  public void setGpsGeom(Point gpsGeom) { this.gpsGeom = gpsGeom; }

  public String getMeta() { return meta; }
  public void setMeta(String meta) { this.meta = meta; }
}
