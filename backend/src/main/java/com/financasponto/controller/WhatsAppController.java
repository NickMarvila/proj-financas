package com.financasponto.controller;

import com.financasponto.entity.Usuario;
import com.financasponto.security.CurrentUser;
import com.financasponto.service.WhatsAppService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/whatsapp")
@RequiredArgsConstructor
public class WhatsAppController {

    private final WhatsAppService whatsAppService;
    private final CurrentUser currentUser;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(whatsAppService.getStatusInfo(currentUser.get()));
    }

    @PostMapping("/instance/create")
    public ResponseEntity<Map<String, Object>> createInstance(
            @RequestParam(required = false, defaultValue = "false") boolean reset) {
        return ResponseEntity.ok(whatsAppService.connectOrCreateInstance(currentUser.get(), reset));
    }

    @GetMapping("/qrcode")
    public ResponseEntity<Map<String, Object>> getQrCode() {
        return ResponseEntity.ok(whatsAppService.connectOrCreateInstance(currentUser.get(), false));
    }

    @DeleteMapping("/instance")
    public ResponseEntity<Map<String, Object>> disconnectInstance() {
        return ResponseEntity.ok(whatsAppService.disconnectInstance(currentUser.get()));
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> sendTest(@RequestBody(required = false) Map<String, String> body) {
        String msg = body != null && body.get("message") != null && !body.get("message").isBlank()
                ? body.get("message")
                : "🤖 Teste do FinançasPonto — WhatsApp conectado e funcionando!";
        Usuario user = currentUser.get();
        try {
            Map<String, Object> res = whatsAppService.sendMessageSync(user, msg);
            return ResponseEntity.ok(res);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
