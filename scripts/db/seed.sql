INSERT INTO users(id, username, password)
SELECT 'a422374b254ddd93948', 'admin', '$2a$10$8Md/.b75xedl0V/8sw4I7.2cWP6Urtmq.jgVNoXc0yhgEBeCA912G'
WHERE NOT EXISTS (
  SELECT username FROM users WHERE username='admin'
);