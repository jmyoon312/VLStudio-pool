import os
import sys
from sqlalchemy import create_engine, MetaData, String, Text, Table, JSON
from sqlalchemy.orm import sessionmaker

# 1. Database URL configuration
# Default Source: PostgreSQL (Users can override via OLD_POSTGRES_URL)
OLD_POSTGRES_URL = os.environ.get("OLD_POSTGRES_URL", "postgresql://viraloop:viraloop@localhost:5432/viraloop")

# Default Target: SQLite production path
DEFAULT_SQLITE_PATH = "C:\\ViraLoopMedia\\viral_loop.db"
NEW_SQLITE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH}")

def migrate_database():
    print("=" * 60)
    print("[ViraLoop Database Migration Tool] Postgres -> SQLite")
    print("=" * 60)
    print(f"Source (PostgreSQL): {OLD_POSTGRES_URL}")
    print(f"Target (SQLite):     {NEW_SQLITE_URL}")
    print("-" * 60)

    # Clean target SQLite database file if it exists for a 100% fresh start
    if NEW_SQLITE_URL.startswith("sqlite:///"):
        sqlite_file_path = NEW_SQLITE_URL.replace("sqlite:///", "")
        sqlite_abs_path = os.path.abspath(sqlite_file_path)
        
        # Ensure target directory exists
        sqlite_dir = os.path.dirname(sqlite_abs_path)
        if sqlite_dir and not os.path.exists(sqlite_dir):
            try:
                os.makedirs(sqlite_dir, exist_ok=True)
                print(f"[OK] Created target directory: {sqlite_dir}")
            except Exception as e:
                print(f"[Warning] Failed to create target directory {sqlite_dir}: {e}")
        
        # Remove existing file to bypass foreign key cycles or stale table locks
        if os.path.exists(sqlite_abs_path):
            print(f"[Setup] Attempting to delete existing target SQLite file: {sqlite_abs_path}")
            try:
                # Remove main database and any WAL/shm files
                os.remove(sqlite_abs_path)
                for suffix in ["-wal", "-shm"]:
                    extra_file = sqlite_abs_path + suffix
                    if os.path.exists(extra_file):
                        os.remove(extra_file)
                print("[OK] Existing SQLite database deleted successfully.")
            except Exception as e:
                print(f"[Warning] File locked or in use (WinError 32). Dropping schemas via SQL connection fallback instead.")

    try:
        # Connect to Source (Postgres)
        print("[Connection] Connecting to PostgreSQL source database...")
        pg_engine = create_engine(OLD_POSTGRES_URL)
        pg_meta = MetaData()
        pg_meta.reflect(bind=pg_engine)
        print(f"[OK] Connected. Found {len(pg_meta.tables)} tables in PostgreSQL.")

        # Connect to Target (SQLite)
        print("[Connection] Connecting to SQLite target database...")
        sqlite_engine = create_engine(NEW_SQLITE_URL)
        
        # Dynamically reflect and drop existing SQLite schemas first to ensure clean slate and avoid index collisions
        print("[Setup] Reflecting and dropping existing SQLite tables and indexes...")
        sqlite_meta_old = MetaData()
        try:
            sqlite_meta_old.reflect(bind=sqlite_engine)
            sqlite_meta_old.drop_all(bind=sqlite_engine)
            print("[OK] Existing SQLite tables and indexes successfully dropped.")
        except Exception as e:
            print(f"[Warning] Failed to drop existing SQLite tables/indexes: {e}")

        # Connect to Target SQLite Metadata
        sqlite_meta = MetaData()

        # 2. Schema Translation & Dialect Remediation
        # Deep copy tables to SQLite metadata while remapping dialect-specific types
        print("[Schema] Remapping schemas and resolving PostgreSQL-specific types...")
        for table_name, table in pg_meta.tables.items():
            # Create a clone of the table for SQLite using non-deprecated to_metadata
            sqlite_table = table.to_metadata(sqlite_meta)
            
            # Resolve pgvector columns and auto-increment defaults
            for column in sqlite_table.columns:
                col_type_name = type(column.type).__name__
                
                # A. Remap pgvector Vector column or unrecognized NullType columns (like reflected vector) to SQLite String representation
                if "Vector" in col_type_name or col_type_name == "Vector" or col_type_name == "NullType" or column.name == "embedding":
                    column.type = String(length=2048)
                    print(f"  [Remap] Remapped custom column {table_name}.{column.name} from {col_type_name} -> String(2048)")
                
                # B. Remap PostgreSQL-specific JSONB / JSON types to SQLite standard JSON
                elif "JSONB" in col_type_name or col_type_name == "JSONB":
                    column.type = JSON()
                    print(f"  [Remap] Remapped custom column {table_name}.{column.name} from {col_type_name} -> JSON")

                # C. Remap PostgreSQL-specific ARRAY types to SQLite standard Text
                elif "ARRAY" in col_type_name or col_type_name == "ARRAY":
                    column.type = Text()
                    print(f"  [Remap] Remapped custom column {table_name}.{column.name} from {col_type_name} -> Text")

                # D. Strip PostgreSQL-specific server_default expressions (like nextval sequences or ::regclass)
                if column.server_default is not None:
                    default_expr = str(column.server_default.arg).lower()
                    if "nextval" in default_expr or "::" in default_expr or "(" in default_expr:
                        column.server_default = None
                        if column.primary_key:
                            column.autoincrement = True
                        print(f"  [Remap] Stripped Postgres-specific default from {table_name}.{column.name}")

        # Resolve duplicate index names in the reflected metadata
        print("[Setup] Resolving duplicate index names in reflected metadata...")
        index_names = {}
        for table in sqlite_meta.tables.values():
            for index in list(table.indexes):
                if not index.name:
                    continue
                idx_key = index.name.lower()
                if idx_key in index_names:
                    print(f"  [Remap] Removed duplicate index '{index.name}' from table '{table.name}' (already defined on '{index_names[idx_key]}')")
                    table.indexes.remove(index)
                else:
                    index_names[idx_key] = table.name

        # Create all tables in SQLite
        print("[Setup] Creating clean table schemas in SQLite...")
        sqlite_meta.create_all(bind=sqlite_engine)
        print("[OK] SQLite database schema successfully initialized.")

        # 3. Data Extraction and Stream Injection (Chunk-based)
        pg_Session = sessionmaker(bind=pg_engine)
        sqlite_Session = sessionmaker(bind=sqlite_engine)

        print("-" * 60)
        print("[Start] Migrating records...")
        
        with pg_Session() as pg_sess, sqlite_Session() as sqlite_sess:
            for table_name in pg_meta.tables.keys():
                table = sqlite_meta.tables[table_name]
                print(f"  [Migration] Migrating table: {table_name} ...", end="", flush=True)
                
                # Fetch all rows from Postgres
                rows = pg_sess.execute(table.select()).fetchall()
                if not rows:
                    print(" (0 records, skipped)")
                    continue
                
                # Insert records in chunks to optimize memory and transaction safety
                chunk_size = 500
                total_records = len(rows)
                
                for i in range(0, total_records, chunk_size):
                    chunk = rows[i:i + chunk_size]
                    insert_vals = [dict(row._mapping) for row in chunk]
                    
                    # Execute bulk insert for SQLite
                    sqlite_sess.execute(table.insert(), insert_vals)
                
                sqlite_sess.flush()
                print(f" ([OK] {total_records} records migrated)")

            print("[Commit] Committing all transactions to target SQLite database...")
            sqlite_sess.commit()
            print("[Success] Data migration completed flawlessly!")
            print("=" * 60)

    except Exception as e:
        print(f"\n[Error] A critical exception occurred: {e}")
        print("[Suggestion] Verify PostgreSQL credentials, connection state, and pip dependencies (pgvector, psycopg2-binary).")
        sys.exit(1)

if __name__ == "__main__":
    migrate_database()
