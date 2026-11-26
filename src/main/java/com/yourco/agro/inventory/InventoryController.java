package com.yourco.agro.inventory;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import static com.yourco.agro.inventory.InventoryDtos.*;

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {
  private final InventoryService inventory;

  public InventoryController(InventoryService inventory) { this.inventory = inventory; }

  @GetMapping
  public Overview overview(@RequestParam long farmId) { return inventory.overview(farmId); }

  @GetMapping("/movements")
  public MovementPage movements(@RequestParam long farmId, @RequestParam(required = false) Long beforeId) {
    return inventory.movements(farmId, beforeId);
  }

  @PostMapping("/products")
  @ResponseStatus(HttpStatus.CREATED)
  public Product createProduct(@Valid @RequestBody CreateProduct request) { return inventory.createProduct(request); }

  @PostMapping("/lots")
  @ResponseStatus(HttpStatus.CREATED)
  public Lot createLot(@Valid @RequestBody CreateLot request) { return inventory.createLot(request); }

  @PostMapping("/movements")
  @ResponseStatus(HttpStatus.CREATED)
  public Movement createMovement(@Valid @RequestBody CreateMovement request) { return inventory.createMovement(request); }
}
