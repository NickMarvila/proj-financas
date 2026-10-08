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

        boolean userHasMatricula = user.getMatricula() != null && !user.getMatricula().trim().isEmpty();
        boolean userHasName = user.getEmployeeName() != null && !user.getEmployeeName().trim().isEmpty();

        // 1. Se o usuário não configurou nenhum identificador no perfil, aceitamos qualquer comprovante da caixa dele
        if (!userHasMatricula && !userHasName) {
            return true;
        }

        // 2. Se a matrícula/PIS do PDF bate com a matrícula do usuário
        if (userHasMatricula && punch.matricula() != null) {
            if (user.getMatricula().trim().equalsIgnoreCase(punch.matricula().trim())) {
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
