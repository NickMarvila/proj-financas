DELETE FROM time_records WHERE user_id = 1 AND timestamp >= CURRENT_DATE; UPDATE usuarios SET gmail_last_sync = NULL WHERE id = 1;
