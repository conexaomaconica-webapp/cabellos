import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Regex matching unqualified id in queries
    // matches " id ", " WHERE id", "(id", "WHERE id=", "AND id=", "SELECT id", "ON id="
    if (/\b(WHERE|AND|OR|ON|SELECT|UPDATE|DELETE\s+FROM|SET)\s+id\b/i.test(line) ||
        /\bSELECT\s+id\s*(,|FROM|INTO)\b/i.test(line) ||
        /\b(WHERE|AND|OR)\s+id\s*=/i.test(line)) {
      console.log(`[${file}:${idx + 1}] ${line.trim()}`);
    }
  });
}
