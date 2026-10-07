package com.financasponto.dto;

import lombok.Data;

/** Payload de cadastro de usuário (somente ADMIN). */
@Data
public class RegisterUserDTO {
    private String username;
    private String password;
    /** Nome exatamente como aparece no comprovante de ponto (bloco COLABORADOR). */
    private String employeeName;
    /** "ADMIN" ou "USER" (padrão USER). */
    private String role;
    /** Opcional: telefone para notificações WhatsApp (ex: 5521999999999). */
    private String whatsappPhone;
    /** Matrícula sem zeros a esquerda (usado para ligar comprovante ao user). */
    private String matricula;
}
