package com.financasponto.utils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class BrazilianHolidays {

    public record HolidayDefinition(LocalDate date, String name, boolean isNational) {}

    public static List<HolidayDefinition> getHolidaysForYear(int year) {
        List<HolidayDefinition> list = new ArrayList<>();

        // Feriados Nacionais Fixos (Leis federais nº 662/1949, 6.802/1980, 10.607/2002, 14.759/2023)
        list.add(new HolidayDefinition(LocalDate.of(year, 1, 1), "Confraternização Universal", true));
        list.add(new HolidayDefinition(LocalDate.of(year, 4, 21), "Tiradentes", true));
        list.add(new HolidayDefinition(LocalDate.of(year, 5, 1), "Dia Mundial do Trabalho", true));
        list.add(new HolidayDefinition(LocalDate.of(year, 9, 7), "Independência do Brasil", true));
        list.add(new HolidayDefinition(LocalDate.of(year, 10, 12), "Nossa Senhora Aparecida", true));
        list.add(new HolidayDefinition(LocalDate.of(year, 11, 2), "Finados", true));
        list.add(new HolidayDefinition(LocalDate.of(year, 11, 15), "Proclamação da República", true));
        list.add(new HolidayDefinition(LocalDate.of(year, 11, 20), "Dia da Consciência Negra", true));
        list.add(new HolidayDefinition(LocalDate.of(year, 12, 25), "Natal", true));

        // Feriados / Datas móveis baseadas na Páscoa
        LocalDate easter = getEasterSunday(year);
        list.add(new HolidayDefinition(easter.minusDays(47), "Carnaval", false));
        list.add(new HolidayDefinition(easter.minusDays(2), "Sexta-feira Santa", true));
        list.add(new HolidayDefinition(easter.plusDays(60), "Corpus Christi", false));

        list.sort((a, b) -> a.date().compareTo(b.date()));
        return list;
    }

    public static LocalDate getEasterSunday(int year) {
        int a = year % 19;
        int b = year / 100;
        int c = year % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31;
        int day = ((h + l - 7 * m + 114) % 31) + 1;
        return LocalDate.of(year, month, day);
    }
}
