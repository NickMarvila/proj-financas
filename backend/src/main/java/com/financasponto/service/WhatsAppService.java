package com.financasponto.service;

import com.financasponto.entity.TimeRecord;
import com.financasponto.entity.WorkDay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppService {

    @Value("${app.whatsapp.api-url}")
    private String apiUrl;

    @Value("${app.whatsapp.api-key}")
    private String apiKey;

    @Value("${app.whatsapp.instance}")
    private String instanceName;

    @Value("${app.whatsapp.phone}")
    private String targetPhone;

    private final WebClient.Builder webClientBuilder;

    private WebClient client() {
        return webClientBuilder.baseUrl(apiUrl)
                .defaultHeader("apikey", apiKey)
                .build();
    }

    public void sendMessage(String message) {
        try {
            Map<String, Object> body = Map.of(
                "number", targetPhone,
                "text", message
            );
            client().post()
                    .uri("/message/sendText/" + instanceName)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .doOnSuccess(r -> log.info("WhatsApp enviado: {}", message.substring(0, Math.min(50, message.length()))))
                    .doOnError(e -> log.error("Erro ao enviar WhatsApp: {}", e.getMessage()))
                    .onErrorResume(e -> Mono.empty())
                    .subscribe();
        } catch (Exception e) {
            log.error("Falha ao enviar mensagem WhatsApp: {}", e.getMessage());
        }
    }

    public void notifyPunchRegistered(TimeRecord record) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        String type = record.getPunchType() == TimeRecord.PunchType.IN ? "✅ ENTRADA" : "🚪 SAÍDA";
        String msg = String.format(
            "%s registrada!\n📅 %s\n📍 Origem: %s",
            type,
            record.getTimestamp().format(fmt),
            record.getOrigin() != null ? record.getOrigin() : "SISTEMA"
        );
        sendMessage(msg);
    }

    public void notifyOvertimeStarted(WorkDay workDay, BigDecimal accumulatedValue) {
        String msg = String.format(
            "⚠️ *HORA EXTRA INICIADA!*\n\n" +
            "📅 Dia: %s\n" +
            "⏰ Você passou do horário contratual\n" +
            "💰 Acumulado no mês: *R$ %s*\n\n" +
            "_Continue caprichando! 💪_",
            workDay.getDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
            accumulatedValue.toPlainString()
        );
        sendMessage(msg);
    }

    public void sendDailySummary(String summaryText) {
        sendMessage(summaryText);
    }

    public String createInstance() {
        try {
            Map<String, Object> body = Map.of(
                "instanceName", instanceName,
                "qrcode", true,
                "integration", "WHATSAPP-BAILEYS"
            );
            return client().post()
                    .uri("/instance/create")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            log.error("Erro ao criar instância: {}", e.getMessage());
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    public String getInstanceStatus() {
        try {
            return client().get()
                    .uri("/instance/fetchInstances")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    public String getQrCode() {
        try {
            return client().get()
                    .uri("/instance/connect/" + instanceName)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }
}
