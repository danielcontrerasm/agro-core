package com.yourco.agro.analytics;

import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {
  private final AnalyticsService service;
  public AnalyticsController(AnalyticsService service) { this.service = service; }

  @GetMapping("/map")
  public Map<String, Object> map(@RequestParam(required = false) Long farmId, @RequestParam(required = false) String layer) { return service.map(farmId, layer); }

  @GetMapping("/dashboard")
  public Map<String, Object> dashboard(@RequestParam Long farmId) { return service.dashboard(farmId); }
}
