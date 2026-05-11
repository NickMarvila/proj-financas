package com.financasponto.utils;

import java.time.LocalDate;

public class CycleUtils {

    public static class Cycle {
        public final int year;
        public final int month;

        public Cycle(int year, int month) {
            this.year = year;
            this.month = month;
        }
    }

    /**
     * Retorna a data de início do ciclo para o mês de referência.
     * O ciclo de "Maio" (mês 5) começa em "21 de Abril".
     */
    public static LocalDate getCycleStart(int year, int month) {
        LocalDate end = getCycleEnd(year, month);
        return end.minusMonths(1).plusDays(1); // Ex: 20/05 -> 20/04 + 1 dia = 21/04
    }

    /**
     * Retorna a data de fim do ciclo para o mês de referência.
     * O ciclo de "Maio" (mês 5) termina em "20 de Maio".
     */
    public static LocalDate getCycleEnd(int year, int month) {
        return LocalDate.of(year, month, 1).withDayOfMonth(20);
    }

    /**
     * Determina qual é o ciclo de referência para uma determinada data.
     * Se dia <= 20, pertence ao mês atual.
     * Se dia >= 21, pertence ao mês seguinte.
     */
    public static Cycle getCurrentCycle(LocalDate date) {
        if (date.getDayOfMonth() <= 20) {
            return new Cycle(date.getYear(), date.getMonthValue());
        } else {
            LocalDate nextMonth = date.plusMonths(1);
            return new Cycle(nextMonth.getYear(), nextMonth.getMonthValue());
        }
    }

    /**
     * Conta o número de sábados no intervalo do ciclo
     */
    public static int countSaturdays(LocalDate start, LocalDate end) {
        int count = 0;
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            if (date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY) {
                count++;
            }
        }
        return count;
    }

    /**
     * Conta o número de sábados no mês calendário (dia 1 ao último dia do mês).
     * Sábados seguem o mês calendário, NÃO o ciclo 21-20.
     */
    public static int countSaturdaysInMonth(int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
        return countSaturdays(start, end);
    }
}
