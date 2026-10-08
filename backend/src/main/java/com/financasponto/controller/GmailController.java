package com.financasponto.controller;

import com.financasponto.dto.SyncAdvancedDTO;
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
    private final com.financasponto.repository.UsuarioRepository usuarioRepository;

    private com.financasponto.entity.Usuario getLoggedUser(java.security.Principal principal) {
        return usuarioRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado"));
    }

    @PostMapping("/connect")
    public ResponseEntity<Map<String, String>> connect(@RequestBody Map<String, String> body, java.security.Principal principal) {
        com.financasponto.entity.Usuario user = getLoggedUser(principal);
        String syncFrom = body.get("syncFrom");
        String url = gmailService.getAuthorizationUrl(user.getId(), syncFrom);
        if (url == null) return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erro ao gerar URL. Verifique as credenciais."));
        return ResponseEntity.ok(Map.of("authUrl", url));
    }

    @GetMapping("/callback")
    public org.springframework.web.servlet.view.RedirectView callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        
        if (error != null) {
            return new org.springframework.web.servlet.view.RedirectView("/perfil?gmail=erro&motivo=" + error);
        }
        if (code == null || state == null) {
            return new org.springframework.web.servlet.view.RedirectView("/perfil?gmail=erro&motivo=parametros_invalidos");
        }
        
        try {
            gmailService.exchangeCode(code, state);
            return new org.springframework.web.servlet.view.RedirectView("/perfil?gmail=ok");
        } catch (Exception e) {
            return new org.springframework.web.servlet.view.RedirectView("/perfil?gmail=erro&motivo=falha_auth");
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(java.security.Principal principal) {
        com.financasponto.entity.Usuario user = getLoggedUser(principal);
        return ResponseEntity.ok(Map.of(
            "hasCredentials", gmailService.hasCredentials(),
            "status", user.getGmailStatus() != null ? user.getGmailStatus() : "DESCONECTADO",
            "email", user.getGmailEmail() != null ? user.getGmailEmail() : "",
            "syncFrom", user.getGmailSyncFrom() != null ? user.getGmailSyncFrom() : "",
            "lastSync", user.getGmailLastSync() != null ? user.getGmailLastSync().toString() : ""
        ));
    }

    @PostMapping("/disconnect")
    public ResponseEntity<Map<String, Object>> disconnect(java.security.Principal principal) {
        com.financasponto.entity.Usuario user = getLoggedUser(principal);
        gmailService.disconnect(user);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> syncNow(java.security.Principal principal) {
        try {
            com.financasponto.entity.Usuario user = getLoggedUser(principal);
            int count = gmailService.syncUser(user);
            return ResponseEntity.ok(Map.of("processed", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/sync-advanced")
    public ResponseEntity<Map<String, Object>> syncAdvanced(@RequestBody SyncAdvancedDTO dto) {
        try {
            if (dto.getUserId() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "userId é obrigatório"));
            }
            com.financasponto.entity.Usuario targetUser = usuarioRepository.findById(dto.getUserId())
                    .orElseThrow(() -> new RuntimeException("Usuário alvo não encontrado"));
            
            if (!"CONECTADO".equals(targetUser.getGmailStatus())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Usuário alvo não está com o Gmail conectado."));
            }

            java.time.LocalDate start = java.time.LocalDate.parse(dto.getStartDate());
            java.time.LocalDate end = java.time.LocalDate.parse(dto.getEndDate());
            
            int count = gmailService.syncUserPeriod(targetUser, start, end);
            return ResponseEntity.ok(Map.of("processed", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
