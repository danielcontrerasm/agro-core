package com.yourco.agro.finances;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class FinanceDtos {
  private FinanceDtos() {}

  public enum EntryType { EXPENSE, INCOME }

  public enum Category {
    FERTILIZERS(EntryType.EXPENSE), PHYTOSANITARY(EntryType.EXPENSE), LABOR(EntryType.EXPENSE),
    IRRIGATION_ENERGY(EntryType.EXPENSE), MAINTENANCE(EntryType.EXPENSE), OTHER_EXPENSE(EntryType.EXPENSE),
    CROP_SALE(EntryType.INCOME), OTHER_INCOME(EntryType.INCOME);

    private final EntryType entryType;
    Category(EntryType entryType) { this.entryType = entryType; }
    public boolean allows(EntryType type) { return entryType == type; }
  }

  public record EntryData(@NotNull LocalDate entryDate, @NotNull EntryType type, @NotNull Category category,
                          @NotNull @Positive @Digits(integer = 12, fraction = 2) BigDecimal amount,
                          @NotBlank @Size(max = 300) String description, @Positive Long fieldId,
                          @Positive Long blockId) {}

  public record CreateEntry(@NotNull @Positive Long farmId, @NotNull UUID operationId,
                            @NotNull @Valid EntryData entry) {}

  public record UpdateEntry(@NotNull @Positive Long farmId, @NotNull @PositiveOrZero Long version,
                            @NotNull @Valid EntryData entry) {}

  public record SaveBudget(@NotNull @Positive Long farmId, @NotBlank String month,
                           @NotNull @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal amount) {}

  public record Entry(long id, long farmId, LocalDate entryDate, EntryType type, Category category,
                      BigDecimal amount, String description, Long fieldId, String fieldName, Long blockId,
                      String blockCode, long version, String sourceType, Long sourceId) {}

  public record Budget(BigDecimal amount, Instant updatedAt) {}

  public record Totals(BigDecimal expenses, BigDecimal income, BigDecimal margin, int entryCount) {}

  public record CategoryTotal(Category category, BigDecimal amount) {}

  public record BlockMargin(long blockId, String blockCode, String fieldName, BigDecimal expenses,
                            BigDecimal income, BigDecimal margin) {}

  public record Month(long farmId, String month, String currency, Totals totals, Budget budget,
                      List<CategoryTotal> expensesByCategory, List<BlockMargin> blockMargins, List<Entry> entries) {}
}
