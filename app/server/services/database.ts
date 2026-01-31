/**
 * DatabaseService
 * Manages D1 database connection for Lauralink.
 * Schema is managed via D1 migrations (script/migrations/001_saas_schema.sql)
 * Do NOT define schema here - use repositories pattern for all queries.
 */
export class DatabaseService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Returns the D1 database instance for use by repositories
   */
  getDatabase(): D1Database {
    return this.db;
  }
}
