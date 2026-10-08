package com.financasponto.utils;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

class GmailQueryBuilderTest {

    private static final String BASE = "from:eventos@pmovel.com.br subject:\"Comprovante de Marcação\" has:attachment";
    private static final ZoneId SAO_PAULO = ZoneId.of("America/Sao_Paulo");

    @Test
    void incrementalQueryComLastSync() {
        LocalDateTime lastSync = LocalDateTime.of(2023, 10, 5, 12, 0);
        long expectedEpoch = lastSync.minusHours(1).atZone(SAO_PAULO).toEpochSecond();

        String query = GmailQueryBuilder.buildIncrementalQuery(lastSync, null);
        assertEquals(BASE + " after:" + expectedEpoch, query);
    }

    @Test
    void incrementalQuerySemLastSyncMasComDataInicial() {
        LocalDate dataInicial = LocalDate.of(2023, 10, 1);
        long expectedEpoch = dataInicial.atStartOfDay(SAO_PAULO).toEpochSecond();

        String query = GmailQueryBuilder.buildIncrementalQuery(null, dataInicial);
        assertEquals(BASE + " after:" + expectedEpoch, query);
    }

    @Test
    void incrementalQuerySemNenhum() {
        String query = GmailQueryBuilder.buildIncrementalQuery(null, null);
        assertEquals(BASE, query);
    }

    @Test
    void periodQueryStartAndEnd() {
        LocalDate start = LocalDate.of(2023, 10, 1);
        LocalDate end = LocalDate.of(2023, 10, 5);

        long startEpoch = start.atStartOfDay(SAO_PAULO).toEpochSecond();
        long endEpoch = end.plusDays(1).atStartOfDay(SAO_PAULO).toEpochSecond();

        String query = GmailQueryBuilder.buildPeriodQuery(start, end);
        assertTrue(query.contains("after:" + startEpoch));
        assertTrue(query.contains("before:" + endEpoch));
        assertTrue(query.startsWith(BASE));
    }

    @Test
    void periodQueryOnlyStart() {
        LocalDate start = LocalDate.of(2023, 10, 1);
        long startEpoch = start.atStartOfDay(SAO_PAULO).toEpochSecond();

        String query = GmailQueryBuilder.buildPeriodQuery(start, null);
        assertTrue(query.contains("after:" + startEpoch));
        assertFalse(query.contains("before:"));
    }

    @Test
    void periodQueryOnlyEnd() {
        LocalDate end = LocalDate.of(2023, 10, 5);
        long endEpoch = end.plusDays(1).atStartOfDay(SAO_PAULO).toEpochSecond();

        String query = GmailQueryBuilder.buildPeriodQuery(null, end);
        assertTrue(query.contains("before:" + endEpoch));
        assertFalse(query.contains("after:"));
    }
}
