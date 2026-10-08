package com.financasponto.dto;

import lombok.Data;

@Data
public class SyncAdvancedDTO {
    private String startDate; // YYYY-MM-DD
    private String endDate;   // YYYY-MM-DD
    private Long userId;      // Optional
}
