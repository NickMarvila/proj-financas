package com.financasponto.config;

import com.financasponto.utils.PunchTextParser;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManagerFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Migração idempotente de mono-usuário para multi-usuário, executada a cada startup.
 *
 * Roda em @PostConstruct depois que o EntityManagerFactory existe (ou seja, depois do
 * ddl-auto=update criar as colunas user_id) e antes dos @Scheduled começarem.
 *
 * 1. Remove as constraints únicas antigas que não incluem user_id
 *    (work_days.date e monthly_summary(month, year)) — o ddl-auto não remove constraints.
 * 2. Atribui ao dono legado todas as linhas com user_id nulo.
 * 3. Garante que exista um ADMIN e tenta preencher o employee_name do dono legado
 *    a partir dos comprovantes que já estão no banco.
 */
@Slf4j
@Component
public class MultiTenantMigration {

    private static final List<String> TENANT_TABLES =
            List.of("time_records", "work_days", "salary_config", "expenses", "monthly_summary");

    private final JdbcTemplate jdbc;

    /** Username dono dos dados antigos. Se vazio, usa o usuário mais antigo (menor id). */
    @Value("${app.multitenant.legacy-owner-username:}")
    private String legacyOwnerUsername;

    public MultiTenantMigration(JdbcTemplate jdbc, EntityManagerFactory emf) {
        // emf é injetado só para garantir que o schema update do Hibernate já rodou
        this.jdbc = jdbc;
    }

    @PostConstruct
    public void migrate() {
        try {
            dropLegacyUniqueConstraints();
            Long ownerId = resolveLegacyOwnerId();
            if (ownerId == null) {
                log.info("[multi-tenant] Nenhum usuário cadastrado; backfill ignorado");
                return;
            }
            backfillUserId(ownerId);
            ensureAdmin(ownerId);
            inferEmployeeName(ownerId);
        } catch (Exception e) {
            // Não derruba a aplicação: os dados continuam acessíveis e a migração tenta de novo no próximo start
            log.error("[multi-tenant] Falha na migração: {}", e.getMessage(), e);
        }
    }

    private void dropLegacyUniqueConstraints() {
        jdbc.execute("""
                DO $$
                DECLARE r record;
                BEGIN
                  FOR r IN
                    SELECT c.conname, t.relname
                    FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    WHERE c.contype = 'u'
                      AND t.relname IN ('work_days', 'monthly_summary')
                      AND NOT EXISTS (
                        SELECT 1 FROM pg_attribute a
                        WHERE a.attrelid = t.oid AND a.attname = 'user_id' AND a.attnum = ANY(c.conkey))
                  LOOP
                    RAISE NOTICE 'Removendo constraint % em %', r.conname, r.relname;
                    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.relname, r.conname);
                  END LOOP;
                END $$;
                """);
    }

    private Long resolveLegacyOwnerId() {
        if (legacyOwnerUsername != null && !legacyOwnerUsername.isBlank()) {
            List<Long> ids = jdbc.queryForList("SELECT id FROM usuarios WHERE username = ?", Long.class, legacyOwnerUsername.trim());
            if (!ids.isEmpty()) return ids.get(0);
            log.warn("[multi-tenant] legacy-owner-username '{}' não encontrado; usando o usuário mais antigo", legacyOwnerUsername);
        }
        List<Long> ids = jdbc.queryForList("SELECT id FROM usuarios ORDER BY id LIMIT 1", Long.class);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private void backfillUserId(Long ownerId) {
        for (String table : TENANT_TABLES) {
            int updated = jdbc.update("UPDATE " + table + " SET user_id = ? WHERE user_id IS NULL", ownerId);
            if (updated > 0) log.info("[multi-tenant] {} linha(s) de {} atribuídas ao usuário {}", updated, table, ownerId);
        }
    }

    private void ensureAdmin(Long ownerId) {
        Integer admins = jdbc.queryForObject("SELECT COUNT(*) FROM usuarios WHERE role = 'ADMIN'", Integer.class);
        if (admins == null || admins == 0) {
            jdbc.update("UPDATE usuarios SET role = 'ADMIN' WHERE id = ?", ownerId);
            log.info("[multi-tenant] Usuário {} promovido a ADMIN", ownerId);
        }
        jdbc.update("UPDATE usuarios SET role = 'USER' WHERE role IS NULL");
    }

    private void inferEmployeeName(Long ownerId) {
        String current = jdbc.queryForObject("SELECT employee_name FROM usuarios WHERE id = ?", String.class, ownerId);
        if (current != null && !current.isBlank()) return;

        List<String> texts = jdbc.queryForList(
                "SELECT raw_text FROM time_records WHERE user_id = ? AND raw_text LIKE '%COLABORADOR%' ORDER BY timestamp DESC LIMIT 1",
                String.class, ownerId);
        if (texts.isEmpty()) return;

        String name = PunchTextParser.extractEmployeeName(texts.get(0));
        if (name != null) {
            jdbc.update("UPDATE usuarios SET employee_name = ? WHERE id = ?", name, ownerId);
            log.info("[multi-tenant] employee_name do usuário {} definido como '{}'", ownerId, name);
        }
    }
}
