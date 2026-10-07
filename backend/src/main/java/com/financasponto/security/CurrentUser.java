package com.financasponto.security;

import com.financasponto.entity.Usuario;
import com.financasponto.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Resolve o {@link Usuario} dono da requisição atual a partir do JWT já validado
 * pelo {@link JwtAuthenticationFilter}. Todo acesso a dados por usuário deve passar por aqui.
 */
@Component
@RequiredArgsConstructor
public class CurrentUser {

    private final UsuarioRepository usuarioRepository;

    public Usuario get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Não autenticado");
        }
        return usuarioRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não encontrado"));
    }

    public Long id() {
        return get().getId();
    }
}
