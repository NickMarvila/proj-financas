package com.financasponto.controller;

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
    public ResponseEntity<Map<String, String>> sendTest(@RequestBody Map<String, String> body) {
        String msg = body.getOrDefault("message", "🤖 Teste do FinançasPonto — tudo funcionando!");
        whatsAppService.sendMessage(msg);
        return ResponseEntity.ok(Map.of("status", "enviado"));
    }
}
