package com.financasponto.controller;

import com.financasponto.service.GmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/gmail")
@RequiredArgsConstructor
public class GmailController {

    private final GmailService gmailService;

    /** Retorna a URL que o usuário deve abrir no browser para autorizar */
    @GetMapping("/auth")
    public ResponseEntity<Map<String, String>> getAuthUrl() {
        String url = gmailService.getAuthorizationUrl();
        if (url == null) return ResponseEntity.internalServerError()
                .body(Map.of("error", "credentials.json não encontrado"));
        return ResponseEntity.ok(Map.of("authUrl", url));
    }

    /** Recebe o código colado pelo usuário e troca pelo token */
    @PostMapping("/code")
    public ResponseEntity<Map<String, Object>> submitCode(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (code == null || code.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "código inválido"));
        boolean ok = gmailService.exchangeCode(code.trim());
        return ResponseEntity.ok(Map.of("success", ok));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of(
            "hasCredentials", gmailService.hasCredentials(),
            "isAuthenticated", gmailService.isAuthenticated()
        ));
    }

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> syncNow() {
        try {
            int count = gmailService.pollAndProcess(false, null);
            return ResponseEntity.ok(Map.of("processed", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/sync-history")
    public ResponseEntity<Map<String, Object>> syncHistory(@RequestBody(required = false) Map<String, String> body) {
        try {
            String afterDate = body != null ? body.get("afterDate") : null;
            int count = gmailService.pollAndProcess(true, afterDate);
            return ResponseEntity.ok(Map.of("processed", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
