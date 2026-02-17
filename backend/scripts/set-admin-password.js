import pool from '../config/database.js'; // dotenv already loaded
import bcrypt from 'bcrypt';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setAdminPassword() {
  try {
    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ admin_users table ready');
    
    rl.question('Enter admin username: ', async (username) => {
      rl.question('Enter new password: ', async (password) => {
        try {
          const hash = await bcrypt.hash(password, 10);
          
          await pool.query(`
            INSERT INTO admin_users (username, password_hash)
            VALUES ($1, $2)
            ON CONFLICT (username) 
            DO UPDATE SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
          `, [username, hash]);
          
          console.log('✅ Admin password updated successfully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error.message);
          process.exit(1);
        }
      });
    });
  } catch (error) {
    console.error('❌ Failed to create admin_users table:', error.message);
    process.exit(1);
  }
}

setAdminPassword();
