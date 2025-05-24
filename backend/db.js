// tscd_main/backend/db.js
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance = null;

export function initializeDB(logger) {
    if (dbInstance) {
        return dbInstance;
    }

    const dataDir = path.resolve('./data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'db.sqlite');
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error(`Failed to open database at ${dbPath}:`, err.message);
            if (logger) logger.error({ err, dbPath }, `Failed to open database`);
            process.exit(1);
        }
        console.log(`Database opened successfully: ${dbPath}`);
        if (logger) logger.info({ dbPath }, `Database opened successfully`);
    });

    // Create users table
    const usersTableStmt = db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        picture TEXT
      )
    `);
    usersTableStmt.run((err) => {
        if (err) {
            console.error("Error running CREATE TABLE users statement:", err.message);
            if (logger) logger.error({ err }, "Error creating users table");
        } else {
            console.log("Users table checked/created successfully.");
            if (logger) logger.info("Users table checked/created successfully.");
        }
    });
    usersTableStmt.finalize((err) => {
      if (err) {
        console.error("Error finalizing CREATE TABLE users statement:", err.message);
      }
    });

    // Create chat_messages table
    const chatMessagesTable = db.prepare(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message_content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    chatMessagesTable.run((err) => {
        if (err) {
            console.error("Error creating chat_messages table:", err.message);
            if (logger) logger.error({ err }, "Error creating chat_messages table");
        } else {
            console.log("chat_messages table checked/created successfully.");
            if (logger) logger.info("chat_messages table checked/created successfully.");
        }
    });
    chatMessagesTable.finalize();

    dbInstance = db;
    return dbInstance;
}

export function getDB() {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call initializeDB first.");
    }
    return dbInstance;
}