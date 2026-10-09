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
     * Ex com cutDay=21: O ciclo de "Maio" (mês 5) começa em "21 de Abril".
     * Ex com cutDay=1: O ciclo começa no dia 1 do próprio mês.
     */
    public static LocalDate getCycleStart(int year, int month, int cutDay) {
        if (cutDay == 1) {
            return LocalDate.of(year, month, 1);
        }
        LocalDate end = getCycleEnd(year, month, cutDay);
        return end.minusMonths(1).plusDays(1);
    }

    /**
     * Retorna a data de fim do ciclo para o mês de referência.
     * Ex com cutDay=21: O ciclo de "Maio" (mês 5) termina em "20 de Maio".
     */
    public static LocalDate getCycleEnd(int year, int month, int cutDay) {
        if (cutDay == 1) {
            return LocalDate.of(year, month, 1).with(java.time.temporal.TemporalAdjusters.lastDayOfMonth());
        }
        return LocalDate.of(year, month, 1).withDayOfMonth(cutDay - 1);
    }

    /**
     * Determina qual é o ciclo de referência para uma determinada data.
     */
    public static Cycle getCurrentCycle(LocalDate date, int cutDay) {
        if (cutDay == 1) {
            return new Cycle(date.getYear(), date.getMonthValue());
        }
        if (date.getDayOfMonth() < cutDay) {
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
