DELETE FROM time_records WHERE user_id = 1 AND timestamp >= '2026-10-07'; DELETE FROM work_days WHERE user_id = 1 AND date >= '2026-10-07'; UPDATE usuarios SET gmail_last_sync = NULL WHERE id = 1;
