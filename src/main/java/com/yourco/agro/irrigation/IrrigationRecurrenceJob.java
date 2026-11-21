package com.yourco.agro.irrigation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDate;

@Component
public class IrrigationRecurrenceJob {
  private static final Logger log=LoggerFactory.getLogger(IrrigationRecurrenceJob.class);
  private final IrrigationService service;
  public IrrigationRecurrenceJob(IrrigationService service) { this.service=service; }

  @Scheduled(cron="${agro.irrigation.recurring.cron:0 15 0 * * *}")
  public void generateUpcomingTasks() {
    var from=LocalDate.now(); var until=from.plusDays(30);
    for (long id: service.activeRecurringScheduleIds()) {
      try { service.generateRecurringAutomatically(id,from,until); }
      catch (RuntimeException exception) { log.warn("No se pudo generar la recurrencia de riego {}",id,exception); }
    }
  }
}
