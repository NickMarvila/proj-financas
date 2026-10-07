package com.financasponto.utils;

import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrai os campos de um comprovante de ponto (texto do PDF/e-mail da pmovel).
 * Classe pura, sem dependências do Spring, para ser testável isoladamente.
 */
@Slf4j
public final class PunchTextParser {

    private static final DateTimeFormatter STAMP_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private static final Pattern STAMP = Pattern.compile("Marca[çc][aã]o:\\s*(\\d{2}/\\d{2}/\\d{4}\\s+\\d{2}:\\d{2}:\\d{2})");
    private static final Pattern ORIGIN = Pattern.compile("Origem:\\s*(.+)");
    private static final Pattern ONLINE = Pattern.compile("Online:\\s*(Sim|N[aã]o|Yes|No)", Pattern.CASE_INSENSITIVE);
    private static final Pattern HASH = Pattern.compile("Hash:\\s*([A-Za-z0-9+/=]+)");
    // O comprovante tem dois "Nome:" — o do EMPREGADOR vem antes. Queremos o do bloco COLABORADOR.
    private static final Pattern EMPLOYEE_NAME = Pattern.compile("COLABORADOR\\s*[\\r\\n]+\\s*Nome:[ \\t]*([^\\r\\n]+)");

    private PunchTextParser() {}

    public record ParsedPunch(LocalDateTime timestamp, String origin, Boolean online, String hash, String employeeName) {}

    public static String extractEmployeeName(String text) {
        if (text == null) return null;
        Matcher m = EMPLOYEE_NAME.matcher(text);
        if (!m.find()) return null;
        String name = m.group(1).trim();
        return name.isEmpty() ? null : name;
    }

    /** Retorna null se o texto não tiver a data/hora da marcação. */
    public static ParsedPunch parse(String text) {
        if (text == null) return null;
        try {
            Matcher stamp = STAMP.matcher(text);
            if (!stamp.find()) {
                log.warn("Data/hora de marcação não encontrada no texto");
                return null;
            }
            LocalDateTime timestamp = LocalDateTime.parse(stamp.group(1).trim(), STAMP_FMT);

            String origin = "SISTEMA";
            Matcher o = ORIGIN.matcher(text);
            if (o.find()) origin = o.group(1).trim();

            Boolean online = null;
            Matcher on = ONLINE.matcher(text);
            if (on.find()) online = on.group(1).equalsIgnoreCase("Sim") || on.group(1).equalsIgnoreCase("Yes");

            String hash = null;
            Matcher h = HASH.matcher(text);
            if (h.find()) hash = h.group(1).trim();

            return new ParsedPunch(timestamp, origin, online, hash, extractEmployeeName(text));
        } catch (Exception e) {
            log.error("Erro ao parsear comprovante: {}", e.getMessage());
            return null;
        }
    }
}
