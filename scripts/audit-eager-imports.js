#!/usr/bin/env node

/**
 * Eager Import Audit
 * 
 * Scans the codebase for patterns that prevent code-splitting:
 * - import.meta.globEager() (deprecated, use import.meta.glob({ eager: true }))
 * - Top-level imports of heavy libraries
 * - Non-lazy route imports
 * - Accidental synchronous dynamic imports
 * 
 * Usage: node scripts/audit-eager-imports.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns to check
const PATTERNS = [
  {
    name: 'Deprecated globEager',
    pattern: /import\.meta\.globEager/g,
    severity: 'error',
    message: 'Use import.meta.glob({ eager: true }) instead',
  },
  {
    name: 'Non-lazy heavy imports',
    pattern: /^import\s+.*\s+from\s+['"](@?(mapbox-gl|recharts|framer-motion|@mux\/mux-player-react))['"]/gm,
    severity: 'warning',
    message: 'Consider lazy loading heavy libraries',
  },
  {
    name: 'Non-lazy route imports',
    pattern: /^import\s+\w+\s+from\s+['"]@\/(pages|features)\/.*['"]/gm,
    severity: 'info',
    message: 'Consider using React.lazy() for route components',
  },
  {
    name: 'Synchronous dynamic import',
    pattern: /await\s+import\([^)]+\)(?!\s*\.then)/g,
    severity: 'info',
    message: 'Ensure this import is wrapped in React.lazy() or deferred',
  },
];

// Heavy libraries that should typically be lazy-loaded
const HEAVY_LIBS = [
  'mapbox-gl',
  'recharts',
  'framer-motion',
  '@mux/mux-player-react',
  'hls.js',
  'qrcode',
  'react-chartjs-2',
  'chart.js',
];

// Scan a file for issues
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  const issues = [];
  
  // Check each pattern
  PATTERNS.forEach(({ name, pattern, severity, message }) => {
    const matches = [...content.matchAll(pattern)];
    
    matches.forEach(match => {
      // Get line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      issues.push({
        file: relativePath,
        line: lineNumber,
        severity,
        pattern: name,
        message,
        code: match[0].trim(),
      });
    });
  });
  
  // Check for heavy library imports in main entry point
  if (filePath.includes('main.tsx') || filePath.includes('App.tsx')) {
    HEAVY_LIBS.forEach(lib => {
      const importPattern = new RegExp(`^import\\s+.*\\s+from\\s+['"]${lib.replace(/\//g, '\\/')}['"]`, 'gm');
      const matches = [...content.matchAll(importPattern)];
      
      matches.forEach(match => {
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        
        issues.push({
          file: relativePath,
          line: lineNumber,
          severity: 'warning',
          pattern: 'Heavy lib in entry point',
          message: `Heavy library "${lib}" imported in entry point - consider lazy loading`,
          code: match[0].trim(),
        });
      });
    });
  }
  
  return issues;
}

// Recursively scan directory
function scanDirectory(dir, issues = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules, dist, etc.
      if (!['node_modules', 'dist', '.git', 'build', 'coverage'].includes(entry.name)) {
        scanDirectory(fullPath, issues);
      }
    } else if (entry.isFile()) {
      // Only scan TS/TSX/JS/JSX files
      if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        const fileIssues = scanFile(fullPath);
        issues.push(...fileIssues);
      }
    }
  });
  
  return issues;
}

// Format and print results
function printResults(issues) {
  if (issues.length === 0) {
    console.log('✅ No eager import issues found!');
    return;
  }
  
  // Group by severity
  const byS = {
    error: issues.filter(i => i.severity === 'error'),
    warning: issues.filter(i => i.severity === 'warning'),
    info: issues.filter(i => i.severity === 'info'),
  };
  
  console.log(`\n📊 Found ${issues.length} potential issues:\n`);
  
  // Print errors
  if (byS.error.length > 0) {
    console.log(`❌ Errors (${byS.error.length}):\n`);
    byS.error.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.pattern}: ${issue.message}`);
      console.log(`    Code: ${issue.code}`);
      console.log('');
    });
  }
  
  // Print warnings
  if (byS.warning.length > 0) {
    console.log(`⚠️  Warnings (${byS.warning.length}):\n`);
    byS.warning.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.pattern}: ${issue.message}`);
      console.log(`    Code: ${issue.code}`);
      console.log('');
    });
  }
  
  // Print info (collapsed)
  if (byS.info.length > 0) {
    console.log(`ℹ️  Info (${byS.info.length}) - Potential optimizations:\n`);
    
    // Group by pattern
    const byPattern = {};
    byS.info.forEach(issue => {
      if (!byPattern[issue.pattern]) {
        byPattern[issue.pattern] = [];
      }
      byPattern[issue.pattern].push(issue);
    });
    
    Object.entries(byPattern).forEach(([pattern, issueList]) => {
      console.log(`  ${pattern} (${issueList.length} occurrences):`);
      issueList.slice(0, 3).forEach(issue => {
        console.log(`    - ${issue.file}:${issue.line}`);
      });
      if (issueList.length > 3) {
        console.log(`    ... and ${issueList.length - 3} more`);
      }
      console.log('');
    });
  }
  
  // Summary
  console.log('─'.repeat(60));
  console.log(`\n📈 Summary:`);
  console.log(`  Errors:   ${byS.error.length}`);
  console.log(`  Warnings: ${byS.warning.length}`);
  console.log(`  Info:     ${byS.info.length}`);
  console.log(`  Total:    ${issues.length}\n`);
  
  // Exit with error if there are errors
  if (byS.error.length > 0) {
    console.log('❌ Fix errors before proceeding\n');
    process.exit(1);
  }
  
  if (byS.warning.length > 0) {
    console.log('💡 Consider addressing warnings to improve bundle size\n');
  }
}

// Main execution
async function main() {
  console.log('🔍 Scanning for eager import patterns...\n');
  
  const srcPath = path.join(__dirname, '../src');
  
  if (!fs.existsSync(srcPath)) {
    console.error('❌ src/ directory not found');
    process.exit(1);
  }
  
  const issues = scanDirectory(srcPath);
  printResults(issues);
  
  console.log('💡 Tips:');
  console.log('  - Use React.lazy() for route components');
  console.log('  - Use dynamic import() for heavy libraries');
  console.log('  - Move heavy imports to the components that need them');
  console.log('  - Consider code-splitting with Suspense boundaries\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

