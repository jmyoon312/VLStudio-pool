from sqlalchemy import inspect, text
from .database import engine, Base
from . import models  # Import models to populate Base.metadata
import logging

logger = logging.getLogger("migration")

def repair_schema():
    """
    [Self-Healing] Automatically detects and adds missing columns from models.py to the database.
    This ensures that newly added fields in SQLAlchemy models are automatically created in the database.
    Supports both SQLite and PostgreSQL.
    """
    print("🚀 [Self-Healing] Starting Automated Schema Synchronization...")
    inspector = inspect(engine)
    
    # All tables defined in SQLAlchemy Base
    for table_name, table in Base.metadata.tables.items():
        if not inspector.has_table(table_name):
            # Table doesn't exist at all, Base.metadata.create_all will handle it
            continue
            
        try:
            existing_columns = [c["name"] for c in inspector.get_columns(table_name)]
        except Exception as e:
            print(f"⚠️ [DB] Could not inspect columns for {table_name}: {e}")
            continue
        
        for column in table.columns:
            if column.name not in existing_columns:
                print(f"➕ [DB] Found missing column: {table_name}.{column.name}")
                
                # Mapping SQLAlchemy types to SQL strings for ALTER TABLE
                try:
                    col_type = str(column.type.compile(engine.dialect))
                except:
                    col_type = "TEXT" # Fallback
                    
                default_clause = ""
                if column.default is not None and hasattr(column.default, 'arg'):
                    val = column.default.arg
                    if isinstance(val, (str, bytes)):
                        default_clause = f" DEFAULT '{val}'"
                    elif isinstance(val, bool):
                        default_clause = f" DEFAULT {'TRUE' if val else 'FALSE'}"
                    elif isinstance(val, (int, float)):
                        default_clause = f" DEFAULT {val}"
                
                # Execute each column addition in a separate connection/transaction
                # to prevent transaction aborts from affecting other columns
                try:
                    with engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}{default_clause}"))
                    print(f"✅ [DB] Successfully added {column.name} to {table_name}")
                except Exception as e:
                    print(f"❌ [DB] Failed to add {column.name} to {table_name}: {e}")

    # Finally, ensure any completely new tables are created
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"⚠️ [DB] Base.metadata.create_all failed: {e}")
        
    print("✨ [Self-Healing] Schema synchronization complete.")

if __name__ == "__main__":
    repair_schema()
