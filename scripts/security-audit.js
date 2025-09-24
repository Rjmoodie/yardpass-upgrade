#!/usr/bin/env node

/**
 * Security audit script for YardPass
 * Runs npm audit and additional security checks
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running Security Audit...\n');

// 1. Run npm audit
console.log('📦 Running npm audit...');
try {
  execSync('npm audit --audit-level=high', { stdio: 'inherit' });
  console.log('✅ npm audit passed\n');
} catch (error) {
  console.error('❌ npm audit found high/critical vulnerabilities');
  console.log('Run "npm audit fix" to attempt automatic fixes\n');
}

// 2. Check for unsafe patterns in code
console.log('🔍 Checking for unsafe code patterns...');
const unsafePatterns = [
  {
    pattern: /dangerouslySetInnerHTML/g,
    file: 'dangerouslySetInnerHTML usage',
    severity: 'WARNING'
  },
  {
    pattern: /eval\(/g,
    file: 'eval() usage',
    severity: 'CRITICAL'
  },
  {
    pattern: /innerHTML\s*=/g,
    file: 'innerHTML assignment',
    severity: 'HIGH'
  },
  {
    pattern: /document\.write/g,
    file: 'document.write usage',
    severity: 'HIGH'
  },
  {
    pattern: /\.exec\(/g,
    file: 'exec() usage',
    severity: 'CRITICAL'
  }
];

function scanDirectory(dir, patterns) {
  const files = fs.readdirSync(dir);
  const findings = [];
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findings.push(...scanDirectory(filePath, patterns));
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      for (const { pattern, file: patternName, severity } of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          findings.push({
            file: filePath,
            pattern: patternName,
            severity,
            count: matches.length
          });
        }
      }
    }
  }
  
  return findings;
}

const findings = scanDirectory('./src', unsafePatterns);

if (findings.length > 0) {
  console.log('⚠️  Security findings:');
  findings.forEach(({ file, pattern, severity, count }) => {
    const icon = severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '⚠️' : '💛';
    console.log(`  ${icon} ${severity}: ${pattern} found ${count} time(s) in ${file}`);
  });
} else {
  console.log('✅ No unsafe patterns found');
}

// 3. Check for environment variable leaks
console.log('\n🔍 Checking for environment variable leaks...');
const envLeakPatterns = [
  /process\.env\./g,
  /import\.meta\.env\./g
];

const envFindings = [];
function scanForEnvLeaks(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanForEnvLeaks(filePath);
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      for (const pattern of envLeakPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          // Check if it's logging or exposing sensitive data
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (pattern.test(line) && (line.includes('console.log') || line.includes('alert'))) {
              envFindings.push({
                file: filePath,
                line: index + 1,
                content: line.trim()
              });
            }
          });
        }
      }
    }
  }
}

scanForEnvLeaks('./src');

if (envFindings.length > 0) {
  console.log('⚠️  Potential environment variable leaks:');
  envFindings.forEach(({ file, line, content }) => {
    console.log(`  ⚠️  ${file}:${line} - ${content}`);
  });
} else {
  console.log('✅ No environment variable leaks found');
}

// 4. Check security headers
console.log('\n🔍 Checking security headers configuration...');
const indexHtml = fs.readFileSync('./index.html', 'utf8');

const requiredHeaders = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'X-XSS-Protection',
  'Referrer-Policy'
];

const missingHeaders = requiredHeaders.filter(header => !indexHtml.includes(header));

if (missingHeaders.length > 0) {
  console.log('⚠️  Missing security headers:');
  missingHeaders.forEach(header => {
    console.log(`  ❌ ${header}`);
  });
} else {
  console.log('✅ All required security headers are configured');
}

console.log('\n🔐 Security audit complete!');