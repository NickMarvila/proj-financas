package com.financasponto;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FinancasPontoApplication {
    public static void main(String[] args) {
        SpringApplication.run(FinancasPontoApplication.class, args);
    }
}
