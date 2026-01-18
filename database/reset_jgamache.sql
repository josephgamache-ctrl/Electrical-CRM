UPDATE users
SET password = '$2b$12$d3nn7BHF65uRBvOqPCjxAu/dZNTBPKI4sfwpzQNEqZ6qLBs7QsUKa',
    failed_login_attempts = 0,
    locked_until = NULL
WHERE username = 'jgamache';
