package com.financasponto.utils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

public final class GmailQueryBuilder {

    private static final String BASE_QUERY = "from:eventos@pmovel.com.br has:attachment filename:pdf";
    private static final ZoneId SAO_PAULO = ZoneId.of("America/Sao_Paulo");

    private GmailQueryBuilder() {}

    public static String buildIncrementalQuery(LocalDateTime lastSync, LocalDate dataInicial) {
        if (lastSync != null) {
            long epochSeconds = lastSync.minusHours(1).atZone(SAO_PAULO).toEpochSecond();
            return BASE_QUERY + " after:" + epochSeconds;
        } else if (dataInicial != null) {
            long epochSeconds = dataInicial.atStartOfDay(SAO_PAULO).toEpochSecond();
            return BASE_QUERY + " after:" + epochSeconds;
        }
        return BASE_QUERY;
    }

    public static String buildPeriodQuery(LocalDate startDate, LocalDate endDate) {
        StringBuilder query = new StringBuilder(BASE_QUERY);
        if (startDate != null) {
            long epochStart = startDate.atStartOfDay(SAO_PAULO).toEpochSecond();
            query.append(" after:").append(epochStart);
        }
        if (endDate != null) {
            long epochEnd = endDate.plusDays(1).atStartOfDay(SAO_PAULO).toEpochSecond();
            query.append(" before:").append(epochEnd);
        }
        return query.toString();
    }
}
