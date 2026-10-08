package com.financasponto.controller;

import com.financasponto.entity.Usuario;
import com.financasponto.repository.UsuarioRepository;
import com.financasponto.security.CurrentUser;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final UsuarioRepository usuarioRepository;
    private final CurrentUser currentUser;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getProfile() {
        Usuario u = currentUser.get();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", u.getUsername());
        body.put("employeeName", u.getEmployeeName());
        body.put("matricula", u.getMatricula());
        body.put("whatsappPhone", u.getWhatsappPhone());
        body.put("role", u.getRole() != null ? u.getRole().name() : Usuario.Role.USER.name());
        return ResponseEntity.ok(body);
    }

    @Data
    public static class ProfileUpdateDTO {
        private String employeeName;
        private String matricula;
        private String whatsappPhone;
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(@RequestBody ProfileUpdateDTO dto) {
        Usuario user = currentUser.get();

        String employeeName = dto.getEmployeeName() != null ? dto.getEmployeeName().trim() : null;
        if (employeeName != null && !employeeName.isEmpty() && !employeeName.equalsIgnoreCase(user.getEmployeeName())) {
            Optional<Usuario> existing = usuarioRepository.findByEmployeeNameIgnoreCase(employeeName);
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Nome de colaborador já vinculado a outro usuário."));
            }
        }

        String matricula = dto.getMatricula() != null ? dto.getMatricula().trim() : null;
        if (matricula != null && !matricula.isEmpty() && !matricula.equalsIgnoreCase(user.getMatricula())) {
            Optional<Usuario> existing = usuarioRepository.findByMatricula(matricula);
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Matrícula/PIS já vinculada a outro usuário."));
            }
        }

        user.setEmployeeName(employeeName == null || employeeName.isEmpty() ? null : employeeName);
        user.setMatricula(matricula == null || matricula.isEmpty() ? null : matricula);
        user.setWhatsappPhone(dto.getWhatsappPhone() != null && !dto.getWhatsappPhone().trim().isEmpty() ? dto.getWhatsappPhone().trim() : null);

        usuarioRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Perfil atualizado com sucesso"));
    }

    @Data
    public static class PasswordUpdateDTO {
        private String currentPassword;
        private String newPassword;
    }

    @PutMapping("/password")
    public ResponseEntity<?> updatePassword(@RequestBody PasswordUpdateDTO dto) {
        Usuario user = currentUser.get();
        if (dto.getCurrentPassword() == null || dto.getNewPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Senhas não podem ser nulas"));
        }
        if (!passwordEncoder.matches(dto.getCurrentPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Senha atual incorreta"));
        }
        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        usuarioRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Senha alterada com sucesso"));
    }
}
