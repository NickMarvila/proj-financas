SELECT user_id, MIN(timestamp), MAX(timestamp) FROM time_records GROUP BY user_id;
