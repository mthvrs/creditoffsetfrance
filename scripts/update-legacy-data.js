#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Normalize time format from MM:SS to 0:MM:SS
function normalizeTime(timeStr) {
  if (!timeStr || !timeStr.trim()) return null;
  
  const cleaned = timeStr.trim();
  if (!cleaned.includes(':')) return null;

  const parts = cleaned.split(':');
  
  if (parts.length === 2) {
    // MM:SS format -> convert to 0:MM:SS
    return `0:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  } else if (parts.length === 3) {
    // Already H:MM:SS or HH:MM:SS format
    return `${parts[0]}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
  }

  return cleaned;
}

// Parse HTML file and extract movie data
function parseHtmlFile(filename) {
  console.log(`📖 Reading file: ${filename}`);
  
  const htmlContent = fs.readFileSync(filename, 'utf-8');
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;

  const movies = [];
  const rows = document.querySelectorAll('tbody tr');

  console.log(`Found ${rows.length} rows in table`);

  rows.forEach((row, index) => {
    try {
      const titleElem = row.querySelector('.show-title');
      const yearElem = row.querySelector('.show-year');
      
      if (!titleElem) return;

      const title = titleElem.textContent.trim();
      
      // Extract year from (YYYY) format
      let year = '';
      if (yearElem) {
        const yearMatch = yearElem.textContent.match(/\((\d{4})\)/);
        if (yearMatch) {
          year = yearMatch[1];
        }
      }

      // Get all td elements
      const cells = row.querySelectorAll('td');
      
      // First td is title, second is Pré-COS, third is COS
      let pre_cos = null;
      let cos = null;

      if (cells.length >= 3) {
        const preCosTxt = cells[1].textContent.trim();
        const cosTxt = cells[2].textContent.trim();
        
        pre_cos = normalizeTime(preCosTxt);
        cos = normalizeTime(cosTxt);
      }

      // Only add if we have at least a COS time
      if (cos) {
        movies.push({
          title,
          year,
          cos,
          pre_cos
        });
      }
    } catch (error) {
      console.error(`Error parsing row ${index + 1}:`, error.message);
    }
  });

  return movies;
}

// Main function
function main() {
  const inputFile = path.join(__dirname, '../historicaldata_17Fev2026.html');
  const outputFile = path.join(__dirname, '../frontend/public/legacy_data.json');
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    console.log('Please make sure "historicaldata_17Fev2026.html" exists in the project root directory.');
    process.exit(1);
  }

  console.log('🚀 Starting legacy data update...\n');

  // Parse the HTML file
  const movies = parseHtmlFile(inputFile);
  console.log(`✅ Parsed ${movies.length} movies from HTML\n`);

  if (movies.length === 0) {
    console.error('❌ No movies found in HTML file. Please check the file format.');
    process.exit(1);
  }

  // Show sample
  console.log('📋 Sample (first 5 movies):');
  movies.slice(0, 5).forEach(movie => {
    console.log(`  - ${movie.title} (${movie.year || 'N/A'})`);
    console.log(`    Pré-COS: ${movie.pre_cos || 'N/A'}, COS: ${movie.cos || 'N/A'}`);
  });
  console.log('');

  // Write to JSON file
  const jsonContent = JSON.stringify(movies, null, 2);
  fs.writeFileSync(outputFile, jsonContent, 'utf-8');

  console.log('✅ Successfully updated legacy_data.json!');
  console.log(`   Location: ${outputFile}`);
  console.log(`   Total movies: ${movies.length}`);
  console.log('');
  console.log('📌 Note: This only updates the "Archives historiques" section.');
  console.log('   The new database is NOT affected by this script.');
}

// Check if jsdom is available
try {
  new JSDOM();
} catch (error) {
  console.error('❌ jsdom is not installed.');
  console.log('\nPlease install dependencies first:');
  console.log('  npm install');
  process.exit(1);
}

// Run the script
try {
  main();
} catch (error) {
  console.error('❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
