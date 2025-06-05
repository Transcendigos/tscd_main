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
        method_sign TEXT NOT NULL,
        picture TEXT,
        totp_secret TEXT
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

	// Create scores table
	const scoresTable = db.prepare(`
	CREATE TABLE IF NOT EXISTS scores (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		tournament_id INTEGER,
		match_id INTEGER NOT NULL,
		user_id INTEGER,
		username TEXT,
		score INTEGER NOT NULL,
		score_against INTEGER NOT NULL,
		won BOOLEAN NOT NULL DEFAULT 0,
		vs_ai BOOLEAN NOT NULL DEFAULT 0,
		duration_seconds INTEGER,
		opponent_id INTEGER,
		opponent_username TEXT,
		is_disconnected BOOLEAN DEFAULT 0,
		rank_delta INTEGER DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (opponent_id) REFERENCES users(id)
	);
	`);
	scoresTable.run((err) => {
	if (err) {
		console.error("Error creating scores table:", err.message);
		if (logger) logger.error({ err }, "Error creating scores table");
	} else {
		console.log("scores table checked/created successfully.");
		if (logger) logger.info("scores table checked/created successfully.");
	}
	});
	scoresTable.finalize();

    dbInstance = db;
    return dbInstance;
}

export function getDB() {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call initializeDB first.");
    }
    return dbInstance;
}