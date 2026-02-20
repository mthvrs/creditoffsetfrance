import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import pool from '../config/database.js';
import adminRouter from '../routes/admin.js';
import jwt from 'jsonwebtoken';

process.env.ADMIN_JWT_SECRET = 'test_secret';

// Mock pool.query
const originalQuery = pool.query;
let lastQuerySql = '';

pool.query = async (text, params) => {
  if (typeof text === 'string') {
      lastQuerySql = text;
  } else {
      lastQuerySql = text.text;
  }

  return { rows: [{
       total_movies: 10,
       total_submissions: 20,
       total_comments: 5,
       total_likes: 100,
       total_dislikes: 2,
       total_comment_likes: 50,
       total_comment_dislikes: 1,
       total_bans: 0,
       total_reports: 0,
       unique_contributors: 15
     }]
  };
};

const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

test('GET /admin/stats uses optimized query', async (t) => {
  const token = jwt.sign({ id: 1, username: 'admin' }, process.env.ADMIN_JWT_SECRET);

  const res = await request(app)
    .get('/admin/stats')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  // The optimized query should use FILTER clauses for likes and comment_likes
  // and combine submission counts.
  const isOptimized = lastQuerySql.includes('FILTER (WHERE') &&
                      lastQuerySql.includes('FROM likes') &&
                      lastQuerySql.includes('FROM comment_likes');

  assert.ok(isOptimized, 'Should use the optimized query with FILTER clauses');
  console.log('✅ Verified optimized query usage');
});
