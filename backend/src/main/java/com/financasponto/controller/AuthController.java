package com.financasponto.controller;

import com.financasponto.dto.LoginDTO;
import com.financasponto.dto.RegisterUserDTO;
import com.financasponto.dto.TokenResponseDTO;
import com.financasponto.entity.Usuario;
import com.financasponto.repository.UsuarioRepository;
import com.financasponto.security.CurrentUser;
import com.financasponto.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginDTO loginDto) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginDto.getUsername(), loginDto.getPassword())
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = jwtUtil.generateToken(authentication.getName());

            return ResponseEntity.ok(new TokenResponseDTO(jwt));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuário ou senha inválidos");
        }
    }

    /** Cadastro de usuário — protegido por ROLE_ADMIN no SecurityConfig. */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterUserDTO dto) {
        if (dto.getUsername() == null || dto.getUsername().isBlank()
                || dto.getPassword() == null || dto.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body("Erro: username e password são obrigatórios");
        }
        if (usuarioRepository.findByUsername(dto.getUsername().trim()).isPresent()) {
            return ResponseEntity.badRequest().body("Erro: Username já existe!");
        }
        String employeeName = dto.getEmployeeName() != null ? dto.getEmployeeName().trim() : null;
        if (employeeName != null && !employeeName.isEmpty()
                && usuarioRepository.findByEmployeeNameIgnoreCase(employeeName).isPresent()) {
            return ResponseEntity.badRequest().body("Erro: já existe usuário vinculado a esse nome de colaborador");
        }
        String cpf = dto.getCpf() != null ? dto.getCpf().trim() : null;
        if (cpf != null && !cpf.isEmpty()
                && usuarioRepository.findByCpf(cpf).isPresent()) {
            return ResponseEntity.badRequest().body("Erro: já existe usuário com este CPF");
        }

        Usuario.Role role;
        try {
            role = dto.getRole() != null ? Usuario.Role.valueOf(dto.getRole().trim().toUpperCase()) : Usuario.Role.USER;
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Erro: role deve ser ADMIN ou USER");
        }

        Usuario user = new Usuario();
        user.setUsername(dto.getUsername().trim());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setEmployeeName(employeeName == null || employeeName.isEmpty() ? null : employeeName);
        user.setRole(role);
        user.setWhatsappPhone(dto.getWhatsappPhone());
        user.setCpf(cpf == null || cpf.isEmpty() ? null : cpf);

        usuarioRepository.save(user);

        return ResponseEntity.ok("Usuário registrado com sucesso!");
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me() {
        Usuario u = currentUser.get();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", u.getId());
        body.put("username", u.getUsername());
        body.put("employeeName", u.getEmployeeName());
        body.put("role", u.getRole() != null ? u.getRole().name() : Usuario.Role.USER.name());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> listUsers() {
        Usuario currentUserEntity = currentUser.get();
        if (currentUserEntity.getRole() != Usuario.Role.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        List<Map<String, Object>> users = usuarioRepository.findAll().stream().map(u -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", u.getId());
            map.put("username", u.getUsername());
            map.put("employeeName", u.getEmployeeName());
            map.put("cpf", u.getCpf());
            map.put("role", u.getRole() != null ? u.getRole().name() : "USER");
            map.put("whatsappPhone", u.getWhatsappPhone());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    /**
     * Permite que administradores alterem a senha de qualquer usuário.
     */
    @PutMapping("/users/{id}/password")
    public ResponseEntity<?> changeUserPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Usuario currentUserEntity = currentUser.get();
        if (currentUserEntity.getRole() != Usuario.Role.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Apenas administradores podem alterar senhas de usuários."));
        }
        String newPassword = body.get("newPassword");
        if (newPassword == null || newPassword.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "A nova senha não pode ser vazia."));
        }
        if (newPassword.trim().length() < 3) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "A nova senha deve ter no mínimo 3 caracteres."));
        }
        Usuario target = usuarioRepository.findById(id).orElse(null);
        if (target == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Usuário não encontrado."));
        }
        target.setPassword(passwordEncoder.encode(newPassword.trim()));
        usuarioRepository.save(target);
        return ResponseEntity.ok(Map.of(
                "message", "Senha do usuário '" + target.getUsername() + "' atualizada com sucesso!",
                "username", target.getUsername()
        ));
    }

    /**
     * Permite que administradores alterem o nível de acesso (Role) de qualquer usuário.
     */
    @PutMapping("/users/{id}/role")
    public ResponseEntity<?> changeUserRole(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Usuario currentUserEntity = currentUser.get();
        if (currentUserEntity.getRole() != Usuario.Role.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Apenas administradores podem alterar o nível de acesso dos usuários."));
        }
        String roleStr = body.get("role");
        if (roleStr == null || roleStr.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "O nível de acesso (role) é obrigatório."));
        }
        Usuario.Role newRole;
        try {
            newRole = Usuario.Role.valueOf(roleStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Nível de acesso inválido. Use ADMIN ou USER."));
        }

        Usuario target = usuarioRepository.findById(id).orElse(null);
        if (target == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuário não encontrado."));
        }

        if (target.getRole() == Usuario.Role.ADMIN && newRole == Usuario.Role.USER) {
            if (currentUserEntity.getId().equals(target.getId())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Você não pode remover seu próprio acesso de administrador."));
            }
            long adminCount = usuarioRepository.findAll().stream().filter(Usuario::isAdmin).count();
            if (adminCount <= 1) {
                return ResponseEntity.badRequest().body(Map.of("message", "Não é possível remover o único administrador do sistema."));
            }
        }

        target.setRole(newRole);
        usuarioRepository.save(target);

        String roleLabel = newRole == Usuario.Role.ADMIN ? "Administrador" : "Funcionário";
        return ResponseEntity.ok(Map.of(
                "message", "Nível de acesso do usuário '" + target.getUsername() + "' alterado para " + roleLabel + " com sucesso!",
                "username", target.getUsername(),
                "role", newRole.name()
        ));
    }
}
