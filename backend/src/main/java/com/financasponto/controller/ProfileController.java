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
        body.put("cpf", u.getCpf());
        body.put("whatsappPhone", u.getWhatsappPhone());
        body.put("role", u.getRole() != null ? u.getRole().name() : Usuario.Role.USER.name());
        body.put("workMonday", u.getWorkMonday());
        body.put("workTuesday", u.getWorkTuesday());
        body.put("workWednesday", u.getWorkWednesday());
        body.put("workThursday", u.getWorkThursday());
        body.put("workFriday", u.getWorkFriday());
        body.put("workSaturday", u.getWorkSaturday());
        body.put("workSunday", u.getWorkSunday());
        body.put("monthlyHoursGoal", u.getMonthlyHoursGoal());
        body.put("firstDayOfWeek", u.getFirstDayOfWeek());
        body.put("firstDayOfMonth", u.getFirstDayOfMonth());
        return ResponseEntity.ok(body);
    }

    @Data
    public static class ProfileUpdateDTO {
        private String employeeName;
        private String cpf;
        private String whatsappPhone;
        private String workMonday;
        private String workTuesday;
        private String workWednesday;
        private String workThursday;
        private String workFriday;
        private String workSaturday;
        private String workSunday;
        private Integer monthlyHoursGoal;
        private String firstDayOfWeek;
        private Integer firstDayOfMonth;
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

        String cpf = dto.getCpf() != null ? dto.getCpf().trim() : null;
        if (cpf != null && !cpf.isEmpty() && !cpf.equalsIgnoreCase(user.getCpf())) {
            Optional<Usuario> existing = usuarioRepository.findByCpf(cpf);
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                return ResponseEntity.badRequest().body(Map.of("message", "CPF já vinculado a outro usuário."));
            }
        }

        user.setEmployeeName(employeeName == null || employeeName.isEmpty() ? null : employeeName);
        user.setCpf(cpf == null || cpf.isEmpty() ? null : cpf);
        user.setWhatsappPhone(dto.getWhatsappPhone() != null && !dto.getWhatsappPhone().trim().isEmpty() ? dto.getWhatsappPhone().trim() : null);

        user.setWorkMonday(dto.getWorkMonday());
        user.setWorkTuesday(dto.getWorkTuesday());
        user.setWorkWednesday(dto.getWorkWednesday());
        user.setWorkThursday(dto.getWorkThursday());
        user.setWorkFriday(dto.getWorkFriday());
        user.setWorkSaturday(dto.getWorkSaturday());
        user.setWorkSunday(dto.getWorkSunday());
        user.setMonthlyHoursGoal(dto.getMonthlyHoursGoal());
        user.setFirstDayOfWeek(dto.getFirstDayOfWeek());
        user.setFirstDayOfMonth(dto.getFirstDayOfMonth());

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
