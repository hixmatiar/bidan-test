UPDATE dbo.users SET failed_attempts=0, locked_until=NULL WHERE username='bidan';
SELECT username,failed_attempts,locked_until FROM dbo.users;
