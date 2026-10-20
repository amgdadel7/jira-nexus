#!/usr/bin/env node
'use strict';

/**
 * CLI Tool: Safe SQLite to PostgreSQL Data Migration
 *
 * Usage:
 *   node src/cli/migrate.js [--source <path>] [--dry-run] [--clean-target] [--verbose] [--report-json <path>]
 *
 * Examples:
 *   node src/cli/migrate.js --dry-run
 *   node src/cli/migrate.js --source data/jira.db
 *   node src/cli/migrate.js --source data/backup.db --report-json migration-report.json
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../config');
const { connectDatabase } = require('../infrastructure/database');
const { runMigration } = require('../infrastructure/database/migration/sqliteToPostgres');

function parseArgs(args) {
  const options = {
    source: path.join(__dirname, '..', '..', 'data', 'jira.db'),
    dryRun: false,
    cleanTarget: false,
    verbose: false,
    reportJson: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      console.log(`
Safe SQLite to PostgreSQL Data Migration CLI

Options:
  --source <path>        Path to source SQLite file (default: api/data/jira.db)
  --dry-run              Inspect, validate, and compute mappings without writing to PostgreSQL
  --clean-target         Drop public schema and apply fresh numbered migrations before loading
  --verbose              Print detailed step logs
  --report-json <path>   Write full JSON migration report to specified file
  --help, -h             Show this help message
      `);
      process.exit(0);
    } else if (arg === '--source') {
      options.source = path.resolve(args[++i]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--clean-target') {
      options.cleanTarget = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--report-json') {
      options.reportJson = path.resolve(args[++i]);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`\n======================================================`);
  console.log(`  Masar Database Migration Tool (SQLite -> PostgreSQL) `);
  console.log(`======================================================`);
  console.log(` Mode:         ${options.dryRun ? 'DRY-RUN (Read Only)' : 'LIVE EXECUTION'}`);
  console.log(` Source DB:    ${options.source}`);
  console.log(` Target:       Configured PostgreSQL / PGlite database`);
  console.log(` Clean Target: ${options.cleanTarget}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(options.source)) {
    console.error(`Error: Source database does not exist at: ${options.source}`);
    process.exit(1);
  }

  const config = loadConfig();
  const targetDb = await connectDatabase(config.database);

  try {
    const report = await runMigration({
      sourceDbPath: options.source,
      targetDb,
      dryRun: options.dryRun,
      verbose: options.verbose,
      cleanTarget: options.cleanTarget,
    });

    console.log('\n--- Migration Summary Report ---');
    console.log(`Status:               ${report.status}`);
    console.log(`Duration:             ${report.durationMs}ms`);
    console.log(`Security Policies:    ${report.securityPoliciesApplied.map((p) => p.policy).join(', ')}`);
    console.log(`Sessions Invalidated: ${report.skippedEntities['sessions'] || 0} (Security policy enforced)`);
    console.log(`Orphans Remediated:   ${report.remediatedOrphans.length}`);
    console.log(`Conflicts Resolved:   ${report.resolvedConflicts.length}`);
    console.log('\nEntity Transfer Counts (Source -> Target):');

    const allKeys = Array.from(new Set([...Object.keys(report.sourceCounts), ...Object.keys(report.targetCounts)])).sort();
    for (const key of allKeys) {
      const src = report.sourceCounts[key] ?? '-';
      const tgt = report.targetCounts[key] ?? '-';
      console.log(`  - ${key.padEnd(25)} : Source=${String(src).padEnd(6)} -> Target=${tgt}`);
    }

    if (report.remediatedOrphans.length > 0) {
      console.log('\nRemediated Orphans Summary:');
      for (const o of report.remediatedOrphans.slice(0, 10)) {
        console.log(`  [!] Table: ${o.table}, ID: ${o.id} - ${o.issue}`);
      }
      if (report.remediatedOrphans.length > 10) {
        console.log(`  ... and ${report.remediatedOrphans.length - 10} more`);
      }
    }

    if (report.resolvedConflicts.length > 0) {
      console.log('\nResolved Conflicts Summary:');
      for (const c of report.resolvedConflicts) {
        console.log(`  [*] Table: ${c.table}, ID: ${c.id} - ${c.issue}`);
      }
    }

    if (options.reportJson) {
      fs.writeFileSync(options.reportJson, JSON.stringify(report, null, 2), 'utf8');
      console.log(`\nFull JSON report saved to: ${options.reportJson}`);
    }

    console.log(`\n======================================================`);
    console.log(` Result: ${report.status}`);
    console.log(`======================================================\n`);
  } finally {
    await targetDb.close();
  }
}

main().catch((err) => {
  console.error('\nFatal migration error:', err);
  process.exit(1);
});
