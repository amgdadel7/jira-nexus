'use strict';
const fs = require('fs');
const path = require('path');
const Database = require(path.join(__dirname, '..', 'api', 'node_modules', 'better-sqlite3'));

const dbPath = path.join(__dirname, '..', 'api', 'data', 'jira.db');
const db = new Database(dbPath, { readonly: true });

const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log('Found tables in jira.db:', tables.map(t => t.name));

let sqlDump = '-- Generated D1 Schema & Initial Data from jira.db\nPRAGMA foreign_keys = OFF;\n\n';

for (const t of tables) {
  sqlDump += `DROP TABLE IF EXISTS "${t.name}";\n`;
  sqlDump += `${t.sql};\n\n`;

  const rows = db.prepare(`SELECT * FROM "${t.name}"`).all();
  if (rows.length > 0) {
    for (const row of rows) {
      const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
      const vals = Object.values(row).map(v => {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return v;
        return `'${String(v).replace(/'/g, "''")}'`;
      }).join(', ');
      sqlDump += `INSERT INTO "${t.name}" (${cols}) VALUES (${vals});\n`;
    }
    sqlDump += '\n';
  }
}

// Add admin amgdadel7@gmail.com
const amgdPass = 'ce203c9ef437af984c53c6eca858a82f:86f7d8176d402b2c56e61eba42e101159dfcb1165f3c820be6b5fe9e01c43947';
sqlDump += `INSERT OR REPLACE INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source")
VALUES ('u0', 'Amjad Alhakimi', 'amgdadel7@gmail.com', '#0C66E4', '${amgdPass}', 'admin', 1, 'Site Administrator', '${new Date().toISOString()}', 1, 'system');\n`;

sqlDump += `INSERT OR IGNORE INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at")
VALUES ('KAN', 'u0', 'admin', 'u0', '${new Date().toISOString()}');\n`;

sqlDump += '\nPRAGMA foreign_keys = ON;\n';

const outPath = path.join(__dirname, 'd1-schema.sql');
fs.writeFileSync(outPath, sqlDump, 'utf8');
console.log(`Successfully generated ${outPath} (${sqlDump.length} bytes, ${tables.length} tables)`);

const users = db.prepare('SELECT id, email, name, role FROM users').all();
console.log('Users in database:', users);
