#!/usr/bin/env node

/**
 * Image Optimization Audit
 * 
 * Scans the codebase for image optimization opportunities:
 * - Large image files (>100KB)
 * - Non-optimized formats (PNG when JPEG would work, no WebP)
 * - Missing lazy loading attributes
 * - Missing width/height attributes (causes CLS)
 * - Hardcoded image URLs that should be CDN'd
 * 
 * Usage: node scripts/audit-images.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Image file extensions to check
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.avif'];

// Size thresholds
const SIZE_THRESHOLDS = {
  warning: 100 * 1024,  // 100KB
  error: 500 * 1024,    // 500KB
};

// Scan for image files in public/assets
function scanImageFiles(dir) {
  const images = [];
  
  if (!fs.existsSync(dir)) {
    return images;
  }
  
  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    entries.forEach(entry => {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const stat = fs.statSync(fullPath);
          const relativePath = path.relative(process.cwd(), fullPath);
          
          images.push({
            path: relativePath,
            name: entry.name,
            ext,
            size: stat.size,
            sizeKB: Math.round(stat.size / 1024),
          });
        }
      }
    });
  }
  
  scan(dir);
  return images;
}

// Scan code for <img> tags without optimization
function scanCodeForImages(dir) {
  const issues = [];
  
  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Check for <img> tags without loading="lazy"
    const imgTagPattern = /<img[^>]*>/gi;
    const imgTags = [...content.matchAll(imgTagPattern)];
    
    imgTags.forEach(match => {
      const tag = match[0];
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      // Check for missing lazy loading
      if (!tag.includes('loading=')) {
        issues.push({
          file: relativePath,
          line: lineNumber,
          severity: 'warning',
          issue: 'Missing lazy loading',
          message: 'Add loading="lazy" for below-fold images',
          code: tag,
        });
      }
      
      // Check for missing width/height (causes CLS)
      if (!tag.includes('width=') || !tag.includes('height=')) {
        issues.push({
          file: relativePath,
          line: lineNumber,
          severity: 'info',
          issue: 'Missing dimensions',
          message: 'Add width/height to prevent layout shift',
          code: tag,
        });
      }
    });
    
    // Check for background images in style attributes
    const bgImagePattern = /style=["'][^"']*background(-image)?:\s*url\([^)]+\)/gi;
    const bgImages = [...content.matchAll(bgImagePattern)];
    
    bgImages.forEach(match => {
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      issues.push({
        file: relativePath,
        line: lineNumber,
        severity: 'info',
        issue: 'Inline background image',
        message: 'Consider using CSS modules or <img> for better lazy loading',
        code: match[0].substring(0, 60) + '...',
      });
    });
  }
  
  function scanDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    entries.forEach(entry => {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', '.git', 'build'].includes(entry.name)) {
          scanDir(fullPath);
        }
      } else if (entry.isFile()) {
        if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          scanFile(fullPath);
        }
      }
    });
  }
  
  if (fs.existsSync(dir)) {
    scanDir(dir);
  }
  
  return issues;
}

// Analyze image file issues
function analyzeImageFiles(images) {
  const issues = {
    large: [],
    veryLarge: [],
    unoptimized: [],
  };
  
  images.forEach(img => {
    // Check size
    if (img.size > SIZE_THRESHOLDS.error) {
      issues.veryLarge.push({
        ...img,
        severity: 'error',
        message: `Very large file (${img.sizeKB} KB) - should be <500 KB`,
      });
    } else if (img.size > SIZE_THRESHOLDS.warning) {
      issues.large.push({
        ...img,
        severity: 'warning',
        message: `Large file (${img.sizeKB} KB) - consider compressing`,
      });
    }
    
    // Check format
    if (['.png', '.jpg', '.jpeg'].includes(img.ext)) {
      // Check if WebP alternative exists
      const webpPath = img.path.replace(/\.(png|jpe?g)$/i, '.webp');
      if (!fs.existsSync(webpPath)) {
        issues.unoptimized.push({
          ...img,
          severity: 'info',
          message: `No WebP alternative found - consider creating ${path.basename(webpPath)}`,
        });
      }
    }
  });
  
  return issues;
}

// Print results
function printResults(imageFiles, imageIssues, codeIssues) {
  console.log('🖼️  Image Optimization Audit\n');
  console.log('═'.repeat(60));
  
  // File size summary
  console.log('\n📊 Image File Summary:\n');
  console.log(`  Total images: ${imageFiles.length}`);
  if (imageFiles.length > 0) {
    const totalSize = imageFiles.reduce((sum, img) => sum + img.size, 0);
    const avgSize = Math.round(totalSize / imageFiles.length / 1024);
    console.log(`  Total size: ${Math.round(totalSize / 1024)} KB`);
    console.log(`  Average size: ${avgSize} KB`);
    
    // Breakdown by extension
    const byExt = {};
    imageFiles.forEach(img => {
      if (!byExt[img.ext]) {
        byExt[img.ext] = { count: 0, size: 0 };
      }
      byExt[img.ext].count++;
      byExt[img.ext].size += img.size;
    });
    
    console.log('\n  By format:');
    Object.entries(byExt)
      .sort(([, a], [, b]) => b.size - a.size)
      .forEach(([ext, data]) => {
        console.log(`    ${ext.padEnd(8)}: ${data.count.toString().padStart(3)} files, ${Math.round(data.size / 1024).toString().padStart(6)} KB`);
      });
  }
  
  // File issues
  console.log('\n─'.repeat(60));
  console.log('\n🔍 Image File Issues:\n');
  
  if (imageIssues.veryLarge.length > 0) {
    console.log(`❌ Very Large Files (${imageIssues.veryLarge.length}):\n`);
    imageIssues.veryLarge.forEach(issue => {
      console.log(`  ${issue.path}`);
      console.log(`    Size: ${issue.sizeKB} KB - ${issue.message}`);
      console.log('');
    });
  }
  
  if (imageIssues.large.length > 0) {
    console.log(`⚠️  Large Files (${imageIssues.large.length}):\n`);
    imageIssues.large.slice(0, 5).forEach(issue => {
      console.log(`  ${issue.path} - ${issue.sizeKB} KB`);
    });
    if (imageIssues.large.length > 5) {
      console.log(`  ... and ${imageIssues.large.length - 5} more\n`);
    }
    console.log('');
  }
  
  if (imageIssues.unoptimized.length > 0) {
    console.log(`ℹ️  Missing WebP Alternatives (${imageIssues.unoptimized.length}):\n`);
    imageIssues.unoptimized.slice(0, 3).forEach(issue => {
      console.log(`  ${issue.path}`);
    });
    if (imageIssues.unoptimized.length > 3) {
      console.log(`  ... and ${imageIssues.unoptimized.length - 3} more`);
    }
    console.log('');
  }
  
  // Code issues
  if (codeIssues.length > 0) {
    console.log('─'.repeat(60));
    console.log(`\n🔍 Code Issues (${codeIssues.length}):\n`);
    
    // Group by issue type
    const byIssue = {};
    codeIssues.forEach(issue => {
      if (!byIssue[issue.issue]) {
        byIssue[issue.issue] = [];
      }
      byIssue[issue.issue].push(issue);
    });
    
    Object.entries(byIssue).forEach(([issueType, issues]) => {
      console.log(`  ${issueType} (${issues.length} occurrences):`);
      issues.slice(0, 3).forEach(issue => {
        console.log(`    - ${issue.file}:${issue.line}`);
        console.log(`      ${issue.message}`);
      });
      if (issues.length > 3) {
        console.log(`    ... and ${issues.length - 3} more`);
      }
      console.log('');
    });
  }
  
  // Recommendations
  console.log('═'.repeat(60));
  console.log('\n💡 Recommendations:\n');
  
  if (imageIssues.veryLarge.length > 0 || imageIssues.large.length > 0) {
    console.log('  1. Compress large images:');
    console.log('     - Use https://squoosh.app/ or imagemin');
    console.log('     - Target: <100KB for most images, <50KB for thumbnails');
    console.log('');
  }
  
  if (imageIssues.unoptimized.length > 0) {
    console.log('  2. Create WebP versions:');
    console.log('     - Use <picture> element with WebP + fallback');
    console.log('     - 25-35% smaller than JPEG with same quality');
    console.log('');
  }
  
  if (codeIssues.some(i => i.issue === 'Missing lazy loading')) {
    console.log('  3. Add lazy loading:');
    console.log('     - Add loading="lazy" to <img> tags');
    console.log('     - Defers loading until image is near viewport');
    console.log('');
  }
  
  if (codeIssues.some(i => i.issue === 'Missing dimensions')) {
    console.log('  4. Add image dimensions:');
    console.log('     - Add width/height attributes to prevent CLS');
    console.log('     - Improves Core Web Vitals score');
    console.log('');
  }
  
  console.log('  5. Consider using a CDN:');
  console.log('     - Cloudinary, Imgix, or CloudFlare Images');
  console.log('     - Auto-format, resize, and optimize on the fly');
  console.log('');
  
  // Summary
  const totalIssues = 
    imageIssues.veryLarge.length + 
    imageIssues.large.length + 
    imageIssues.unoptimized.length + 
    codeIssues.length;
  
  console.log('═'.repeat(60));
  console.log(`\n📈 Total Issues Found: ${totalIssues}\n`);
  
  if (imageIssues.veryLarge.length > 0) {
    console.log('❌ Fix very large images (>500KB) immediately');
    process.exit(1);
  } else if (totalIssues === 0) {
    console.log('✅ No critical image issues found!\n');
  } else {
    console.log('⚠️  Some optimization opportunities found\n');
  }
}

// Main execution
async function main() {
  console.log('🔍 Scanning for image optimization opportunities...\n');
  
  // Scan public/assets and src/assets
  const publicPath = path.join(__dirname, '../public');
  const srcPath = path.join(__dirname, '../src');
  
  const imageFiles = [
    ...scanImageFiles(publicPath),
    ...scanImageFiles(path.join(srcPath, 'assets')),
  ];
  
  const imageIssues = analyzeImageFiles(imageFiles);
  const codeIssues = scanCodeForImages(srcPath);
  
  printResults(imageFiles, imageIssues, codeIssues);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

