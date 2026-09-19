import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Look for unqualified id column in WHERE, JOIN, ON, SELECT, GROUP BY
    if (/\bWHERE\s+id\b/i.test(line) || /\bAND\s+id\b/i.test(line) || /\bOR\s+id\b/i.test(line) || /\bON\s+id\b/i.test(line) || /\bSELECT\s+id\b/i.test(line)) {
      console.log(`[${file}:${idx + 1}] ${line.trim()}`);
    }
  });
}
