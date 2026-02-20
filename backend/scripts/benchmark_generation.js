import axios from 'axios';
import pool from '../config/database.js';
import { generateTestData } from '../utils/testDataGenerator.js';

// Mock Data
const MOCK_MOVIES = Array.from({ length: 50 }, (_, i) => ({
  id: 1000 + i,
  title: `Test Movie ${i}`,
  original_title: `Test Movie Original ${i}`,
  release_date: '2023-01-01',
  poster_path: '/path.jpg'
}));

const MOCK_DETAILS = {
  runtime: 120
};

// Mock axios
const originalGet = axios.get;
const originalPost = axios.post;

axios.get = async (url, config) => {
  // Simulate network latency for API
  await new Promise(resolve => setTimeout(resolve, 50)); // 50ms latency

  if (url.includes('movie/popular')) {
    return { data: { results: MOCK_MOVIES } };
  }
  if (url.includes('movie/')) {
    return { data: MOCK_DETAILS };
  }
  return { data: {} };
};

axios.post = async (url, data) => {
  // Mock Discord webhook
  return { data: {} };
};

// Mock Pool
const originalQuery = pool.query;
const originalConnect = pool.connect;

let queryCount = 0;

// Mock implementation of query
pool.query = async (text, params) => {
  queryCount++;
  await new Promise(resolve => setTimeout(resolve, 5)); // 5ms DB latency

  let rows = [{ id: Math.floor(Math.random() * 10000) }];

  // Detect bulk insert for movies
  if (text.includes('INSERT INTO movies') && params.length > 6) {
    const count = params.length / 6;
    rows = [];
    for (let i = 0; i < count; i++) {
        // We need to return valid tmdb_id and runtime to map back
        // The params order is id, title, original_title, release_date, poster_path, runtime
        // indices: i*6, i*6+1, ... i*6+5
        rows.push({
            id: 10000 + i,
            tmdb_id: params[i*6],
            runtime: params[i*6+5]
        });
    }
  }

  // Detect bulk insert for submissions
  if (text.includes('INSERT INTO submissions') && params.length > 8) {
     const count = params.length / 8;
     rows = Array.from({ length: count }, (_, i) => ({ id: 20000 + i }));
  }

  return {
    rows,
    rowCount: rows.length
  };
};

pool.connect = async () => {
  return {
    query: pool.query,
    release: () => {},
    // Add mock for transaction methods if needed (not used in current generateTestData but might be in future)
  };
};

async function runBenchmark() {
  console.log('🚀 Starting benchmark (with MOCKED DB & API)...');

  queryCount = 0;
  const start = performance.now();

  try {
    await generateTestData('BENCHMARK_SCRIPT');
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  }

  const end = performance.now();
  const duration = (end - start) / 1000;

  console.log(`⏱️ Execution time: ${duration.toFixed(2)} seconds`);
  console.log(`🔢 Total DB Queries: ${queryCount}`);

  // Restore mocks
  axios.get = originalGet;
  axios.post = originalPost;
  pool.query = originalQuery;
  pool.connect = originalConnect;
}

runBenchmark();
