package com.financasponto.utils;

import com.financasponto.entity.Usuario;
import com.financasponto.utils.PunchTextParser.ParsedPunch;

public final class PunchOwnershipPolicy {

    private PunchOwnershipPolicy() {}

    /**
     * Verifica se um comprovante (punch) pertence a um usuário autenticado.
     */
    public static boolean isOwner(Usuario user, ParsedPunch punch) {
        if (user == null || punch == null) return false;

        boolean userHasCpf = user.getCpf() != null && !user.getCpf().trim().isEmpty();
        boolean userHasName = user.getEmployeeName() != null && !user.getEmployeeName().trim().isEmpty();

        // 1. Se o usuário não configurou nenhum identificador no perfil, aceitamos qualquer comprovante da caixa dele
        if (!userHasCpf && !userHasName) {
            return true;
        }

        // 2. Se o CPF do PDF bate com o CPF do usuário
        if (userHasCpf && punch.cpf() != null) {
            if (user.getCpf().trim().equalsIgnoreCase(punch.cpf().trim())) {
                return true;
            }
        }

        // 3. Se o nome do colaborador bate (case-insensitive)
        if (userHasName && punch.employeeName() != null) {
            if (user.getEmployeeName().trim().equalsIgnoreCase(punch.employeeName().trim())) {
                return true;
            }
        }

        // 4. Descarta se não houver correspondência
        return false;
    }
}
