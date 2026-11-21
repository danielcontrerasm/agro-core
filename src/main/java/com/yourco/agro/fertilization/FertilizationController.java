package com.yourco.agro.fertilization;

import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.Map;
import static com.yourco.agro.fertilization.FertilizationDtos.*;

@RestController
@RequestMapping("/api/v1/fertilization")
public class FertilizationController {
  private final FertilizationService service;
  public FertilizationController(FertilizationService service) { this.service=service; }
  @GetMapping public Map<String,Object> list(@RequestParam long farmId) { return service.list(farmId); }
  @GetMapping("/profiles") public java.util.List<Map<String,Object>> profiles(@RequestParam long farmId) { return service.profiles(farmId); }
  @PostMapping("/profiles") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> profile(@Valid @RequestBody Profile request) { return service.createProfile(request); }
  @GetMapping("/products") public java.util.List<Map<String,Object>> products(@RequestParam long farmId) { return service.products(farmId); }
  @PostMapping("/products") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> product(@Valid @RequestBody Product request) { return service.createProduct(request); }
  @PostMapping("/analyses") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> analysis(@Valid @RequestBody Analysis request) { return service.createAnalysis(request); }
  @PostMapping("/analyses/{id}/review") public Map<String,Object> review(@PathVariable long id,@Valid @RequestBody Review request) { return service.review(id,request); }
  @PostMapping("/plans") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> plan(@Valid @RequestBody Plan request) { return service.createPlan(request); }
  @PostMapping("/plans/{id}/approve") public Map<String,Object> approve(@PathVariable long id,@Valid @RequestBody Decision request) { return service.decision(id,request,true); }
  @PostMapping("/plans/{id}/cancel") public Map<String,Object> cancel(@PathVariable long id,@Valid @RequestBody Decision request) { return service.decision(id,request,false); }
  @PostMapping("/plans/{id}/task") public Map<String,Object> task(@PathVariable long id) { return service.task(id); }
  @PostMapping("/plans/{id}/applications") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> apply(@PathVariable long id,@Valid @RequestBody Application request) { return service.apply(id,request); }
  @PostMapping("/plans/{id}/followups") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void followup(@PathVariable long id,@Valid @RequestBody Followup request) { service.followup(id,request); }
  @PostMapping(value="/analyses/{id}/report",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.NO_CONTENT)
  public void report(@PathVariable long id,@RequestParam MultipartFile file) throws IOException { service.report(id,file.getBytes(),file.getContentType()); }
  @GetMapping("/analyses/{id}/report") public ResponseEntity<byte[]> report(@PathVariable long id) {
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header("Content-Disposition","attachment; filename=lab-"+id+".pdf").header("X-Content-Type-Options","nosniff").cacheControl(CacheControl.noStore()).body(service.report(id));
  }
}
