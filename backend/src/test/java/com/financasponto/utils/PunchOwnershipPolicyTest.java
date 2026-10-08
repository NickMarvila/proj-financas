package com.financasponto.utils;

import com.financasponto.entity.Usuario;
import com.financasponto.utils.PunchTextParser.ParsedPunch;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class PunchOwnershipPolicyTest {

    private ParsedPunch createPunch(String matricula, String employeeName) {
        return new ParsedPunch(LocalDateTime.now(), "SISTEMA", true, "hash", employeeName, matricula);
    }

    private Usuario createUser(String matricula, String employeeName) {
        Usuario u = new Usuario();
        u.setMatricula(matricula);
        u.setEmployeeName(employeeName);
        return u;
    }

    @Test
    void aceitaQuandoUsuarioNaoTemMatriculaNemNome() {
        Usuario user = createUser(null, null);
        ParsedPunch punch = createPunch("123", "João Silva");
        assertTrue(PunchOwnershipPolicy.isOwner(user, punch));

        user = createUser("", "  ");
        assertTrue(PunchOwnershipPolicy.isOwner(user, punch));
    }

    @Test
    void aceitaQuandoMatriculaBate() {
        Usuario user = createUser("12345", "Nome Errado");
        ParsedPunch punch = createPunch("12345", "João Silva");
        assertTrue(PunchOwnershipPolicy.isOwner(user, punch));
    }

    @Test
    void aceitaQuandoNomeBateCaseInsensitive() {
        Usuario user = createUser("111", "João SILVA");
        ParsedPunch punch = createPunch("222", "joão silva");
        assertTrue(PunchOwnershipPolicy.isOwner(user, punch));
    }

    @Test
    void descartaQuandoNaoCorresponde() {
        Usuario user = createUser("111", "Maria");
        ParsedPunch punch = createPunch("222", "João");
        assertFalse(PunchOwnershipPolicy.isOwner(user, punch));
    }

    @Test
    void descartaQuandoPdfNaoTemIdentificadoresEUsuarioTem() {
        Usuario user = createUser("111", "Maria");
        ParsedPunch punch = createPunch(null, null);
        assertFalse(PunchOwnershipPolicy.isOwner(user, punch));
    }
}
