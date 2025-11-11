#!/usr/bin/env node

/**
 * Track Bundle Metrics to PostHog
 * 
 * Runs after `npm run build` to send bundle size metrics to PostHog
 * for trend tracking and alerting.
 * 
 * Usage: node scripts/track-bundle-metrics.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostHog configuration (can be overridden with env vars)
const POSTHOG_API_KEY = process.env.VITE_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const ENABLE_TRACKING = process.env.CI || process.env.TRACK_BUNDLE_METRICS === 'true';

// Get git information
function getGitInfo() {
  try {
    return {
      branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
      commit: execSync('git rev-parse HEAD').toString().trim(),
      shortCommit: execSync('git rev-parse --short HEAD').toString().trim(),
      author: execSync('git log -1 --pretty=format:"%an"').toString().trim(),
      message: execSync('git log -1 --pretty=format:"%s"').toString().trim(),
    };
  } catch (error) {
    console.warn('⚠️  Could not get git info:', error.message);
    return {
      branch: 'unknown',
      commit: 'unknown',
      shortCommit: 'unknown',
      author: 'unknown',
      message: 'unknown',
    };
  }
}

// Analyze bundle files
function analyzeBundleFiles() {
  const distPath = path.join(__dirname, '../dist/assets');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ dist/assets directory not found. Run `npm run build` first.');
    process.exit(1);
  }
  
  const files = fs.readdirSync(distPath).filter(f => f.endsWith('.js'));
  
  const chunks = {};
  let totalSize = 0;
  
  files.forEach(file => {
    const filePath = path.join(distPath, file);
    const stat = fs.statSync(filePath);
    const sizeKB = Math.round(stat.size / 1024);
    
    // Categorize chunks
    let category = 'other';
    if (file.includes('vendor-')) category = 'vendor';
    else if (file.includes('index-')) category = 'index';
    else if (file.includes('mapbox-')) category = 'mapbox';
    else if (file.includes('charts-')) category = 'charts';
    else if (file.includes('hls-')) category = 'hls';
    else if (file.includes('analytics-')) category = 'analytics';
    else if (file.includes('motion-')) category = 'motion';
    else if (file.includes('ui-')) category = 'ui';
    
    if (!chunks[category]) {
      chunks[category] = { size: 0, files: [] };
    }
    
    chunks[category].size += sizeKB;
    chunks[category].files.push({ name: file, size: sizeKB });
    totalSize += sizeKB;
  });
  
  return {
    chunks,
    totalSize,
    chunkCount: files.length,
    criticalPath: (chunks.vendor?.size || 0) + (chunks.index?.size || 0),
  };
}

// Send metrics to PostHog
async function sendToPostHog(metrics) {
  if (!POSTHOG_API_KEY) {
    console.warn('⚠️  PostHog API key not found. Set VITE_PUBLIC_POSTHOG_KEY to enable tracking.');
    return;
  }
  
  if (!ENABLE_TRACKING) {
    console.log('ℹ️  Tracking disabled. Set CI=true or TRACK_BUNDLE_METRICS=true to enable.');
    return;
  }
  
  const gitInfo = getGitInfo();
  
  const event = {
    api_key: POSTHOG_API_KEY,
    event: 'bundle_metrics',
    properties: {
      // Bundle metrics
      vendor_size_kb: metrics.chunks.vendor?.size || 0,
      index_size_kb: metrics.chunks.index?.size || 0,
      critical_path_kb: metrics.criticalPath,
      total_size_kb: metrics.totalSize,
      chunk_count: metrics.chunkCount,
      
      // Categorized chunk sizes
      mapbox_size_kb: metrics.chunks.mapbox?.size || 0,
      charts_size_kb: metrics.chunks.charts?.size || 0,
      hls_size_kb: metrics.chunks.hls?.size || 0,
      analytics_size_kb: metrics.chunks.analytics?.size || 0,
      motion_size_kb: metrics.chunks.motion?.size || 0,
      ui_size_kb: metrics.chunks.ui?.size || 0,
      other_size_kb: metrics.chunks.other?.size || 0,
      
      // Git context
      git_branch: gitInfo.branch,
      git_commit: gitInfo.commit,
      git_short_commit: gitInfo.shortCommit,
      git_author: gitInfo.author,
      git_message: gitInfo.message,
      
      // Environment
      ci: process.env.CI === 'true',
      node_version: process.version,
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
    distinct_id: `build_${gitInfo.shortCommit}`,
  };
  
  try {
    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    
    if (response.ok) {
      console.log('✅ Bundle metrics sent to PostHog');
    } else {
      console.error('❌ Failed to send metrics to PostHog:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Error sending metrics to PostHog:', error.message);
  }
}

// Main execution
async function main() {
  console.log('📊 Analyzing bundle metrics...\n');
  
  const metrics = analyzeBundleFiles();
  const gitInfo = getGitInfo();
  
  // Print summary
  console.log('📦 Bundle Analysis:');
  console.log(`  Critical Path: ${metrics.criticalPath} KB (vendor: ${metrics.chunks.vendor?.size || 0} KB + index: ${metrics.chunks.index?.size || 0} KB)`);
  console.log(`  Total Size: ${metrics.totalSize} KB`);
  console.log(`  Chunk Count: ${metrics.chunkCount}`);
  console.log('');
  
  console.log('📊 Chunk Breakdown:');
  Object.entries(metrics.chunks)
    .sort(([, a], [, b]) => b.size - a.size)
    .forEach(([name, data]) => {
      console.log(`  ${name.padEnd(12)}: ${data.size.toString().padStart(6)} KB (${data.files.length} files)`);
    });
  console.log('');
  
  console.log('🔧 Git Context:');
  console.log(`  Branch: ${gitInfo.branch}`);
  console.log(`  Commit: ${gitInfo.shortCommit}`);
  console.log(`  Author: ${gitInfo.author}`);
  console.log(`  Message: ${gitInfo.message}`);
  console.log('');
  
  // Send to PostHog
  await sendToPostHog(metrics);
  
  // Check limits
  const VENDOR_LIMIT = 350;
  const CRITICAL_LIMIT = 400;
  
  let hasErrors = false;
  
  if (metrics.chunks.vendor?.size > VENDOR_LIMIT) {
    console.error(`❌ Vendor chunk (${metrics.chunks.vendor.size} KB) exceeds limit (${VENDOR_LIMIT} KB)`);
    hasErrors = true;
  }
  
  if (metrics.criticalPath > CRITICAL_LIMIT) {
    console.error(`❌ Critical path (${metrics.criticalPath} KB) exceeds limit (${CRITICAL_LIMIT} KB)`);
    hasErrors = true;
  }
  
  if (hasErrors) {
    console.log('');
    console.log('💡 Tips to reduce bundle size:');
    console.log('  - Use dynamic import() for heavy components');
    console.log('  - Review manualChunks in vite.config.ts');
    console.log('  - Run `npm run build:analyze` to visualize bundle');
    process.exit(1);
  } else {
    console.log('✅ All bundle size limits passed!');
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

