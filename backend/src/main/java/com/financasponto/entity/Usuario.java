package com.financasponto.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    /** Nome do colaborador exatamente como aparece no comprovante (linha "Nome:" do bloco COLABORADOR). */
    @Column(name = "employee_name")
    private String employeeName;

    @Column(unique = true)
    private String matricula;

    /** Anulável no banco: o ddl-auto não consegue criar coluna NOT NULL em tabela com dados. Null = USER. */
    @Enumerated(EnumType.STRING)
    private Role role = Role.USER;

    /** Telefone para notificações WhatsApp. Se nulo, o ADMIN usa o telefone global (app.whatsapp.phone). */
    @Column(name = "whatsapp_phone")
    private String whatsappPhone;

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public enum Role {
        ADMIN, USER
    }
}
