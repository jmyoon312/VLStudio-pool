import sqlite3
import os

db_path = r'C:/Users/jmyoo/AppData/Local/ViraLoop Studio/viral_loop.db'
if not os.path.exists(db_path):
    print(f'DB not found at {db_path}')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

new_columns = [
    ('profile_type', 'VARCHAR')
]

for col, dtype in new_columns:
    try:
        cursor.execute(f'ALTER TABLE profiles ADD COLUMN {col} {dtype}')
        print(f'Added {col}')
    except Exception as e:
        print(f'Failed to add {col}: {e}')

conn.commit()

# Initialize all existing records to TIN_CAN
cursor.execute("UPDATE profiles SET profile_type = 'TIN_CAN' WHERE profile_type IS NULL")
conn.commit()

conn.close()
