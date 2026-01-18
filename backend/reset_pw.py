import bcrypt
import psycopg2

# Generate hash
password = "TestAdmin123!"
hash_bytes = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
password_hash = hash_bytes.decode()
print(f"Generated hash: {password_hash}")

# Connect to database
conn = psycopg2.connect(
    host="ma_electrical-db",
    database="ma_electrical_inventory",
    user="postgres",
    password="postgres"
)
cur = conn.cursor()

# Update password
cur.execute("UPDATE users SET password = %s, failed_login_attempts = 0 WHERE username = %s", (password_hash, "jgamache"))
conn.commit()
print(f"Updated {cur.rowcount} rows")

# Verify
cur.execute("SELECT password FROM users WHERE username = %s", ("jgamache",))
result = cur.fetchone()
print(f"Stored hash: {result[0]}")

cur.close()
conn.close()
