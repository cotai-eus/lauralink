CREATE TABLE IF NOT EXISTS shares (
	id TEXT PRIMARY KEY,
	total_size_bytes INTEGER NOT NULL,
	file_count INTEGER NOT NULL,
	password_salt TEXT,
	password_hash TEXT,
	password_iterations INTEGER,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS share_files (
	id TEXT PRIMARY KEY,
	share_id TEXT NOT NULL,
	original_name TEXT NOT NULL,
	content_type TEXT NOT NULL,
	size_bytes INTEGER NOT NULL,
	r2_key TEXT NOT NULL UNIQUE,
	sort_order INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_share_files_share_id_sort_order
	ON share_files (share_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_share_files_r2_key
	ON share_files (r2_key);

INSERT OR IGNORE INTO shares (
	id,
	total_size_bytes,
	file_count,
	created_at
)
SELECT
	files.id,
	files.size_bytes,
	1,
	files.uploaded_at
FROM files;

INSERT OR IGNORE INTO share_files (
	id,
	share_id,
	original_name,
	content_type,
	size_bytes,
	r2_key,
	sort_order,
	created_at
)
SELECT
	'legacy-' || files.id,
	files.id,
	files.original_name,
	files.content_type,
	files.size_bytes,
	files.r2_key,
	0,
	files.uploaded_at
FROM files;
