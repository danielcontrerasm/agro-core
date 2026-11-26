package com.yourco.agro.inventory;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class InventoryDtos {
  private InventoryDtos() {}

  public enum Direction { IN, OUT }
  public enum LotStatus { AVAILABLE, EXPIRING, EXPIRED, EMPTY }

  public record CreateProduct(
    @NotNull @Positive Long farmId,
    @NotBlank @Size(max = 60) String code,
    @NotBlank @Size(max = 150) String name,
    @NotBlank @Size(max = 80) String category,
    @NotBlank @Size(max = 30) String unit,
    @NotNull @DecimalMin("0") @Digits(integer = 13, fraction = 6) BigDecimal minimum) {}

  public record CreateLot(
    @NotNull @Positive Long farmId,
    @NotNull @Positive Long productId,
    @NotBlank @Size(max = 80) String code,
    LocalDate expiresOn,
    @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal unitCostCop) {}

  public record UpdateLotCost(@NotNull @Positive Long farmId,
                              @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal unitCostCop) {}

  public record CreateMovement(
    @NotNull @Positive Long farmId,
    @NotNull @Positive Long lotId,
    @NotNull UUID requestId,
    @NotNull Direction direction,
    @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 13, fraction = 6) BigDecimal quantity,
    @Size(max = 180) String reference,
    @Size(max = 1000) String notes) {}

  public record Product(long id, String code, String name, String category, String unit,
                        BigDecimal minimum, BigDecimal available, BigDecimal balance, boolean lowStock) {}

  public record Lot(long id, long productId, String code, LocalDate expiresOn, BigDecimal balance, LotStatus status,
                    boolean hasUnitCost, @JsonInclude(JsonInclude.Include.NON_NULL) BigDecimal unitCostCop,
                    @JsonInclude(JsonInclude.Include.NON_NULL) BigDecimal stockValueCop) {}

  public record Movement(long id, long lotId, Direction direction, BigDecimal quantity, BigDecimal balanceAfter,
                         String reference, String notes, Instant createdAt, long createdByUserId, String createdBy,
                         LocalDate appliedOn, @JsonInclude(JsonInclude.Include.NON_NULL) BigDecimal unitCostCop,
                         @JsonInclude(JsonInclude.Include.NON_NULL) BigDecimal costCop) {}

  public record ApplicationConsumption(long movementId, String productName, String unit, String lotCode,
                                       BigDecimal unitCostCop, BigDecimal costCop) {}

  public record MovementPage(List<Movement> entries, Long nextBeforeId) {}

  public record Overview(List<Product> products, List<Lot> lots, MovementPage movements) {}
}
