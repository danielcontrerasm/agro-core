package com.yourco.agro.events.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name="observation_detail")
public class ObservationDetail {
  @Id
  @Column(name="event_id")
  private Long eventId;

  @OneToOne(fetch = FetchType.LAZY)
  @MapsId
  @JoinColumn(name="event_id")
  private FieldEvent event;

  @Column(name="suspected_catalog_id")
  private Long suspectedCatalogId;

  private Integer severity;

  @Column(columnDefinition = "text")
  private String symptoms;

  @Column(name="ai_diagnosis_json", columnDefinition = "jsonb")
  @JdbcTypeCode(SqlTypes.JSON)
  private String aiDiagnosisJson;

  public Long getEventId() { return eventId; }
  public void setEventId(Long eventId) { this.eventId = eventId; }

  public FieldEvent getEvent() { return event; }
  public void setEvent(FieldEvent event) { this.event = event; }

  public Long getSuspectedCatalogId() { return suspectedCatalogId; }
  public void setSuspectedCatalogId(Long suspectedCatalogId) { this.suspectedCatalogId = suspectedCatalogId; }

  public Integer getSeverity() { return severity; }
  public void setSeverity(Integer severity) { this.severity = severity; }

  public String getSymptoms() { return symptoms; }
  public void setSymptoms(String symptoms) { this.symptoms = symptoms; }

  public String getAiDiagnosisJson() { return aiDiagnosisJson; }
  public void setAiDiagnosisJson(String aiDiagnosisJson) { this.aiDiagnosisJson = aiDiagnosisJson; }
}
