#!/usr/bin/env node
/**
 * Secret scanner utility.
 * Scans the repository for committed secrets, API tokens, or hardcoded credentials.
 * SECURITY RULE: NEVER outputs the matched secret value. Outputs [MASKED] only.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.vscode',
  'dist',
  'bin',
  'obj',
  'artifacts',
  '.system_generated',
  'jira-clone'
]);

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.zip', '.tar', '.gz',
  '.lock', '.pdf', '.woff', '.woff2', '.ttf', '.eot'
]);

// Patterns that identify secrets. Values must NEVER be logged.
const SECRET_RULES = [
  {
    name: 'Production Supabase/External Connection String with Password',
    regex: /(?:Host=[^;\r\n]+;.*Password=(?!YOUR_SECURE_PASSWORD|your_db_password|admin)[^;\r\n]+)|(?:postgres(?:ql)?:\/\/(?!user:pass|masar:masar)[^:]+:(?!admin|your_db_password|password|masar)[^@]+@[^/\r\n]+)/i,
    ignoreIfContains: 'DATABASE_URL      postgres://user:pass',
  },
  {
    name: 'Hardcoded Production Mirat DSN',
    regex: /https:\/\/mirat-monitor\.onrender\.com\/api\/events\/[A-Za-z0-9_-]{20,}/i,
  },
  {
    name: 'Default Insecure Session Secret',
    regex: /masar_session_secret_prod_signing_key_jira_2026/,
    ignoreIfContains: 'INSECURE_DEFAULT_SECRET', // Allowed only in security guard checks
  },
];

function scanFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  // Skip this scanner script itself
  if (relPath === 'scripts/check-secrets.js') return [];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of SECRET_RULES) {
      if (rule.ignoreIfContains && line.includes(rule.ignoreIfContains)) {
        continue;
      }
      if (rule.regex.test(line)) {
        issues.push({
          file: relPath,
          line: i + 1,
          rule: rule.name,
        });
      }
    }
  }

  return issues;
}

function walkDir(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!IGNORED_EXTENSIONS.has(ext)) {
        const issues = scanFile(fullPath);
        results = results.concat(issues);
      }
    }
  }

  return results;
}

console.log('--- Scanning repository for exposed secrets (Safe Scan - No Values Displayed) ---');
const findings = walkDir(ROOT_DIR);

if (findings.length > 0) {
  console.error(`\nFAILED: Found ${findings.length} potential secret(s) in repository files:\n`);
  for (const f of findings) {
    console.error(`  [FAIL] ${f.file}:${f.line} -> Violation: ${f.rule} [VALUE MASKED: ***]`);
  }
  console.error('\nPlease remove hardcoded credentials and replace with environment variables or secure references.\n');
  process.exit(1);
} else {
  console.log('\n[PASS] No exposed secrets detected across scanned files.');
  process.exit(0);
}
