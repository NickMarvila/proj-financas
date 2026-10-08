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
        String matricula = dto.getMatricula() != null ? dto.getMatricula().trim() : null;
        if (matricula != null && !matricula.isEmpty()
                && usuarioRepository.findByMatricula(matricula).isPresent()) {
            return ResponseEntity.badRequest().body("Erro: já existe usuário com esta matrícula");
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
        user.setMatricula(matricula == null || matricula.isEmpty() ? null : matricula);

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
            map.put("matricula", u.getMatricula());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }
}
