package com.financasponto.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financasponto.entity.TimeRecord;
import com.financasponto.entity.Usuario;
import com.financasponto.entity.WorkDay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
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

    @Value("${app.whatsapp.phone:}")
    private String targetPhone;

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    private WebClient client() {
        return webClientBuilder.baseUrl(apiUrl)
                .defaultHeader("apikey", apiKey)
                .build();
    }

    /**
     * Normaliza número de telefone para o padrão da Evolution API (apenas dígitos com DDI 55).
     */
    public String normalizePhone(String rawPhone) {
        if (rawPhone == null) return null;
        String digits = rawPhone.replaceAll("\\D", "");
        if (digits.isEmpty()) return null;
        if (digits.length() == 10 || digits.length() == 11) {
            digits = "55" + digits;
        }
        return digits;
    }

    /**
     * Telefone de destino do usuário: o cadastrado nele, ou o global para o ADMIN.
     * Retorna null se o usuário não deve ser notificado.
     */
    public String resolvePhone(Usuario user) {
        if (user == null) return null;
        if (user.getWhatsappPhone() != null && !user.getWhatsappPhone().isBlank()) {
            return normalizePhone(user.getWhatsappPhone());
        }
        return user.isAdmin() ? normalizePhone(targetPhone) : null;
    }

    /** Envia de forma assíncrona (para jobs e gatilhos automáticos de batida). */
    public void sendMessageTo(Usuario user, String message) {
        String phone = resolvePhone(user);
        if (phone == null) {
            log.debug("Usuário {} sem telefone WhatsApp; notificação ignorada", user != null ? user.getUsername() : null);
            return;
        }
        sendMessageAsync(phone, message);
    }

    private void sendMessageAsync(String phone, String message) {
        String normalized = normalizePhone(phone);
        if (normalized == null || normalized.isBlank()) return;
        try {
            Map<String, Object> body = Map.of(
                "number", normalized,
                "text", message
            );
            client().post()
                    .uri("/message/sendText/" + instanceName)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .doOnSuccess(r -> log.info("WhatsApp enviado para {}: {}", normalized, message.substring(0, Math.min(40, message.length())).replace("\n", " ")))
                    .doOnError(e -> {
                        if (e instanceof WebClientResponseException wce) {
                            log.error("Erro HTTP {} ao enviar WhatsApp para {}: {}", wce.getStatusCode(), normalized, wce.getResponseBodyAsString());
                        } else {
                            log.error("Erro ao enviar WhatsApp para {}: {}", normalized, e.getMessage());
                        }
                    })
                    .onErrorResume(e -> Mono.empty())
                    .subscribe();
        } catch (Exception e) {
            log.error("Falha ao disparar mensagem WhatsApp: {}", e.getMessage());
        }
    }

    /**
     * Envia mensagem de forma síncrona (usado no botão "Enviar Teste" do painel Admin),
     * validando que a instância está conectada e propagando erros reais da Evolution API.
     */
    public Map<String, Object> sendMessageSync(Usuario user, String message) {
        String phone = resolvePhone(user);
        if (phone == null || phone.isBlank()) {
            throw new IllegalArgumentException("Seu usuário não possui telefone WhatsApp configurado no Meu Perfil.");
        }

        Map<String, Object> status = getStatusInfo(user);
        boolean connected = Boolean.TRUE.equals(status.get("connected"));
        String state = String.valueOf(status.getOrDefault("state", "disconnected"));
        if (!connected) {
            throw new IllegalStateException("O WhatsApp não está conectado (status atual: " + state + "). Gere e escaneie o QR Code antes de enviar o teste.");
        }

        try {
            Map<String, Object> body = Map.of(
                "number", phone,
                "text", message
            );
            String response = client().post()
                    .uri("/message/sendText/" + instanceName)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("WhatsApp de teste enviado com sucesso para {}", phone);
            return Map.of(
                "status", "enviado",
                "phone", phone,
                "response", response != null ? response : "{}"
            );
        } catch (WebClientResponseException e) {
            String respBody = e.getResponseBodyAsString();
            log.error("Erro da Evolution API ao enviar teste ({}): {}", e.getStatusCode(), respBody);
            throw new IllegalStateException("Falha ao enviar pelo WhatsApp (" + e.getStatusCode().value() + "): verifique se o número " + phone + " possui WhatsApp válido.");
        } catch (Exception e) {
            log.error("Falha ao enviar teste WhatsApp: {}", e.getMessage());
            throw new IllegalStateException("Erro ao comunicar com a Evolution API: " + e.getMessage());
        }
    }

    public void notifyPunchRegistered(Usuario user, TimeRecord record) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        String type = record.getPunchType() == TimeRecord.PunchType.IN ? "✅ ENTRADA" : "🚪 SAÍDA";
        String msg = String.format(
            "%s registrada!\n📅 %s\n📍 Origem: %s",
            type,
            record.getTimestamp().format(fmt),
            record.getOrigin() != null ? record.getOrigin() : "SISTEMA"
        );
        sendMessageTo(user, msg);
    }

    public void notifyOvertimeStarted(Usuario user, WorkDay workDay, BigDecimal accumulatedValue) {
        String msg = String.format(
            "⚠️ *HORA EXTRA INICIADA!*\n\n" +
            "📅 Dia: %s\n" +
            "⏰ Você passou do horário contratual\n" +
            "💰 Acumulado no ciclo: *R$ %s*\n\n" +
            "_Continue caprichando! 💪_",
            workDay.getDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
            accumulatedValue.toPlainString()
        );
        sendMessageTo(user, msg);
    }

    public void sendDailySummary(Usuario user, String summaryText) {
        sendMessageTo(user, summaryText);
    }

    /**
     * Consulta o status estruturado da instância na Evolution API v2.
     */
    public Map<String, Object> getStatusInfo(Usuario currentUser) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("instanceName", instanceName);
        result.put("exists", false);
        result.put("state", "disconnected");
        result.put("connected", false);
        result.put("ownerJid", null);
        result.put("profileName", null);
        result.put("targetPhone", currentUser != null ? resolvePhone(currentUser) : normalizePhone(targetPhone));

        try {
            String raw = client().get()
                    .uri("/instance/fetchInstances")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            if (raw == null || raw.isBlank()) {
                return result;
            }

            JsonNode root = objectMapper.readTree(raw);
            if (root.isArray()) {
                for (JsonNode item : root) {
                    String name = textOrNull(item, "name");
                    if (name == null && item.has("instance")) {
                        name = textOrNull(item.get("instance"), "instanceName");
                    }
                    if (instanceName.equalsIgnoreCase(name)) {
                        result.put("exists", true);
                        String state = textOrNull(item, "connectionStatus");
                        if (state == null && item.has("instance")) {
                            state = textOrNull(item.get("instance"), "status");
                        }
                        if (state == null) state = "close";
                        result.put("state", state);
                        result.put("connected", "open".equalsIgnoreCase(state));

                        String ownerJid = textOrNull(item, "ownerJid");
                        if (ownerJid != null && ownerJid.contains("@")) {
                            ownerJid = "+" + ownerJid.substring(0, ownerJid.indexOf('@'));
                        }
                        result.put("ownerJid", ownerJid);
                        result.put("profileName", textOrNull(item, "profileName"));
                        break;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Não foi possível consultar status da Evolution API: {}", e.getMessage());
            result.put("state", "error");
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * Cria ou reconecta a instância e retorna o QR Code pronto (data:image/png;base64,...)
     * ou indica que já está conectado.
     */
    public Map<String, Object> connectOrCreateInstance(Usuario currentUser, boolean forceReset) {
        if (forceReset) {
            deleteInstanceSilently();
        }

        Map<String, Object> status = getStatusInfo(currentUser);
        if (Boolean.TRUE.equals(status.get("connected"))) {
            Map<String, Object> out = new LinkedHashMap<>(status);
            out.put("base64", "");
            return out;
        }

        boolean exists = Boolean.TRUE.equals(status.get("exists"));
        String qrBase64 = null;

        if (exists) {
            qrBase64 = fetchConnectQrBase64();
            // Se a instância já existia mas não retornou QR Code (sessão Baileys travada), recria do zero
            if (qrBase64 == null || qrBase64.isBlank()) {
                log.info("Instância {} sem QR Code ativo; recriando instância na Evolution API...", instanceName);
                deleteInstanceSilently();
                exists = false;
            }
        }

        if (!exists) {
            qrBase64 = createNewInstanceAndGetQr();
        }

        // Aguardar até 4 tentativas rápidas caso o Baileys ainda esteja gerando o QR Code
        for (int i = 0; i < 4 && (qrBase64 == null || qrBase64.isBlank()); i++) {
            try {
                Thread.sleep(1200);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
                break;
            }
            qrBase64 = fetchConnectQrBase64();
        }

        Map<String, Object> updatedStatus = getStatusInfo(currentUser);
        updatedStatus.put("base64", normalizeQrDataUri(qrBase64));
        return updatedStatus;
    }

    public Map<String, Object> disconnectInstance(Usuario currentUser) {
        deleteInstanceSilently();
        return getStatusInfo(currentUser);
    }

    private void deleteInstanceSilently() {
        try {
            client().delete()
                    .uri("/instance/logout/" + instanceName)
                    .retrieve()
                    .bodyToMono(String.class)
                    .onErrorResume(e -> Mono.empty())
                    .block();
        } catch (Exception ignored) {}
        try {
            client().delete()
                    .uri("/instance/delete/" + instanceName)
                    .retrieve()
                    .bodyToMono(String.class)
                    .onErrorResume(e -> Mono.empty())
                    .block();
        } catch (Exception ignored) {}
    }

    private String createNewInstanceAndGetQr() {
        try {
            Map<String, Object> body = Map.of(
                "instanceName", instanceName,
                "qrcode", true,
                "integration", "WHATSAPP-BAILEYS"
            );
            String raw = client().post()
                    .uri("/instance/create")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return extractBase64FromJson(raw);
        } catch (WebClientResponseException e) {
            log.warn("Aviso ao criar instância ({}): {}", e.getStatusCode(), e.getResponseBodyAsString());
            return null;
        } catch (Exception e) {
            log.error("Erro ao criar instância: {}", e.getMessage());
            return null;
        }
    }

    private String fetchConnectQrBase64() {
        try {
            String raw = client().get()
                    .uri("/instance/connect/" + instanceName)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return extractBase64FromJson(raw);
        } catch (Exception e) {
            log.debug("Erro ao buscar QR Code em /instance/connect/{}: {}", instanceName, e.getMessage());
            return null;
        }
    }

    private String extractBase64FromJson(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            JsonNode node = objectMapper.readTree(raw);
            String b64 = textOrNull(node, "base64");
            if (b64 == null && node.has("qrcode")) {
                b64 = textOrNull(node.get("qrcode"), "base64");
            }
            return b64;
        } catch (Exception e) {
            return null;
        }
    }

    private String normalizeQrDataUri(String b64) {
        if (b64 == null || b64.isBlank()) return "";
        String trimmed = b64.trim();
        if (trimmed.startsWith("data:image")) {
            return trimmed;
        }
        return "data:image/png;base64," + trimmed;
    }

    private String textOrNull(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return null;
        String val = node.get(field).asText();
        return (val != null && !val.isBlank()) ? val : null;
    }
}
