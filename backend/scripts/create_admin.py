import argparse
import os
import sys

import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_db_connection():
    db_password = os.getenv("DB_PASSWORD")
    if not db_password:
        raise RuntimeError("DB_PASSWORD environment variable must be set")

    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "ma_electrical"),
        user=os.getenv("DB_USER", "postgres"),
        password=db_password,
        host=os.getenv("DB_HOST", "ma_electrical-db"),
        port=os.getenv("DB_PORT", "5432"),
        cursor_factory=RealDictCursor,
    )


def users_table_exists(cur) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'users'
        ) AS exists
        """
    )
    return bool(cur.fetchone()["exists"])


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bootstrap or update an admin user in the MA Electrical Inventory database."
    )
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument(
        "--min-length",
        type=int,
        default=12,
        help="Minimum password length to enforce (default: 12).",
    )
    parser.add_argument("--role", default="admin")
    parser.add_argument("--full-name", default=None)
    parser.add_argument("--email", default=None)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Update existing user password/role instead of failing.",
    )

    args = parser.parse_args()

    if args.min_length < 1:
        print("--min-length must be at least 1.", file=sys.stderr)
        return 2

    if len(args.password) < args.min_length:
        print(
            f"Refusing to set a password shorter than {args.min_length} characters.",
            file=sys.stderr,
        )
        return 2

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if not users_table_exists(cur):
            print("Users table not found. Ensure the database schema has been initialized.", file=sys.stderr)
            return 3

        cur.execute("SELECT username FROM users WHERE username = %s", (args.username,))
        existing = cur.fetchone()

        password_hash = hash_password(args.password)

        if existing and not args.force:
            print(
                f"User '{args.username}' already exists. Re-run with --force to update.",
                file=sys.stderr,
            )
            return 4

        if existing:
            cur.execute(
                """
                UPDATE users
                SET password = %s,
                    role = %s,
                    full_name = COALESCE(%s, full_name),
                    email = COALESCE(%s, email),
                    active = TRUE
                WHERE username = %s
                """,
                (password_hash, args.role, args.full_name, args.email, args.username),
            )
            conn.commit()
            print(f"Updated user '{args.username}' (role={args.role}).")
            return 0

        cur.execute(
            """
            INSERT INTO users (username, password, full_name, email, role, active)
            VALUES (%s, %s, %s, %s, %s, TRUE)
            """,
            (args.username, password_hash, args.full_name, args.email, args.role),
        )
        conn.commit()
        print(f"Created user '{args.username}' (role={args.role}).")
        return 0
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
