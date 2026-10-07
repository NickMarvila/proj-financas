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
    public ResponseEntity<String> getStatus() {
        return ResponseEntity.ok(whatsAppService.getInstanceStatus());
    }

    @PostMapping("/instance/create")
    public ResponseEntity<String> createInstance() {
        return ResponseEntity.ok(whatsAppService.createInstance());
    }

    @GetMapping("/qrcode")
    public ResponseEntity<String> getQrCode() {
        return ResponseEntity.ok(whatsAppService.getQrCode());
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, String>> sendTest(@RequestBody(required = false) Map<String, String> body) {
        String msg = body != null && body.get("message") != null
                ? body.get("message")
                : "🤖 Teste do FinançasPonto — tudo funcionando!";
        Usuario user = currentUser.get();
        if (whatsAppService.resolvePhone(user) == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Seu usuário não tem telefone WhatsApp cadastrado"));
        }
        whatsAppService.sendMessageTo(user, msg);
        return ResponseEntity.ok(Map.of("status", "enviado"));
    }
}
