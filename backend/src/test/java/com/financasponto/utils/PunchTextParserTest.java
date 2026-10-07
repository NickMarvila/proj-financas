package com.financasponto.utils;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class PunchTextParserTest {

    // Texto real extraído de um comprovante (PDF) da pmovel
    private static final String RECEIPT = """
            COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR
            EMPREGADOR
            Nome: ATERRADO
            CNPJ: 08.842.314/0003-05
            Endereço: - -
            COLABORADOR
            Nome: NICOLAS MARVILA DE OLIVEIRA
            CPF: 19553186700
            PIS: 13921929899
            REGISTRO
            Marcação: 28/09/2026 18:05:40
            Origem: FACE
            Online: Sim
            Hash:
            JDJ5JDEwJElQa25mc2pqVjNyNHJWYi5jUzcuOXVQOGZVU203Y0pTM29nUFdUVXEwT2RF
            TGpWVXZ4WVNP
            ASSINATURA DIGITAL
            """;

    @Test
    void extractsEmployeeNameFromColaboradorBlockNotEmployer() {
        assertEquals("NICOLAS MARVILA DE OLIVEIRA", PunchTextParser.extractEmployeeName(RECEIPT));
    }

    @Test
    void extractsEmployeeNameWithWindowsLineEndingsAndExtraSpaces() {
        String text = "EMPREGADOR\r\nNome: ATERRADO\r\nCOLABORADOR\r\n  Nome:   JOAO DA SILVA  \r\nCPF: 1\r\n";
        assertEquals("JOAO DA SILVA", PunchTextParser.extractEmployeeName(text));
    }

    @Test
    void returnsNullWhenThereIsNoColaboradorBlock() {
        assertNull(PunchTextParser.extractEmployeeName("Nome: ATERRADO\nMarcação: 28/09/2026 18:05:40"));
        assertNull(PunchTextParser.extractEmployeeName(null));
    }

    @Test
    void parsesPunchFields() {
        PunchTextParser.ParsedPunch punch = PunchTextParser.parse(RECEIPT);

        assertNotNull(punch);
        assertEquals(LocalDateTime.of(2026, 9, 28, 18, 5, 40), punch.timestamp());
        assertEquals("FACE", punch.origin());
        assertEquals(Boolean.TRUE, punch.online());
        assertEquals("NICOLAS MARVILA DE OLIVEIRA", punch.employeeName());
    }

    @Test
    void returnsNullWhenTimestampIsMissing() {
        assertNull(PunchTextParser.parse("COLABORADOR\nNome: FULANO\nOrigem: FACE"));
    }
}
