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

    db.serialize(() => {
        // Create users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                method_sign TEXT NOT NULL,
                picture TEXT,
                totp_secret TEXT
            )
        `, (err) => {
            if (err) {
                if (logger) logger.error({ err }, "Error creating users table");
            } else {
                if (logger) logger.info("Users table checked/created successfully.");
            }
        });

        // Create chat_messages table
        db.run(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                message_content TEXT NOT NULL,
                drawing_data_url TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                if (logger) logger.error({ err }, "Error creating chat_messages table");
            } else {
                if (logger) logger.info("chat_messages table checked/created successfully.");
            }
        });

        // Create scores table
        db.run(`
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tournament_id INTEGER,
                user_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                if (logger) logger.error({ err }, "Error creating scores table");
            } else {
                if (logger) logger.info("scores table checked/created successfully.");
            }
        });

        // Create blocked users table
        db.run(`
            CREATE TABLE IF NOT EXISTS blocked_users (
                blocker_id INTEGER NOT NULL,
                blocked_id INTEGER NOT NULL,
                FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (blocker_id, blocked_id)
            )
        `, (err) => {
            if (err) {
                if (logger) logger.error({ err }, "Error creating blocked_users table");
            } else {
                if (logger) logger.info("blocked_users table checked/created successfully.");
            }
        });

        // Create tournaments table
        db.run(`
            CREATE TABLE IF NOT EXISTS tournaments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                creator_id INTEGER NOT NULL,
                size INTEGER NOT NULL CHECK(size IN (4, 8)),
                status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'in_progress', 'finished', 'aborted')),
                winner_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES users(id),
                FOREIGN KEY (winner_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                if (logger) logger.error({ err }, "Error creating tournaments table");
            } else {
                if (logger) logger.info("Tournaments table checked/created successfully.");
            }
        });

        // Create tournament_participants table
        db.run(`
            CREATE TABLE IF NOT EXISTS tournament_participants (
                tournament_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                join_order INTEGER NOT NULL,
                PRIMARY KEY (tournament_id, user_id),
                FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                if (logger) logger.error({ err }, "Error creating tournament_participants table");
            } else {
                if (logger) logger.info("Tournament participants table checked/created successfully.");
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS match_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_mode TEXT NOT NULL,
                player1_id INTEGER NOT NULL,
                player2_id INTEGER NOT NULL,
                player1_score INTEGER NOT NULL,
                player2_score INTEGER NOT NULL,
                winner_id INTEGER NOT NULL,
                played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                tournament_id INTEGER,
                FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                if (logger) logger.error({ err }, "Error creating match_history table");
            } else {
                if (logger) logger.info("match_history table checked/created successfully.");
            }
        });

        // Create tournament_matches table
        db.run(`
            CREATE TABLE IF NOT EXISTS tournament_matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tournament_id INTEGER NOT NULL,
                round INTEGER NOT NULL,
                match_in_round INTEGER NOT NULL,
                player1_id INTEGER,
                player2_id INTEGER,
                winner_id INTEGER,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'finished')),
                game_id TEXT,
                FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                FOREIGN KEY (player1_id) REFERENCES users(id),
                FOREIGN KEY (player2_id) REFERENCES users(id),
                FOREIGN KEY (winner_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                if (logger) logger.error({ err }, "Error creating tournament_matches table");
            } else {
                if (logger) logger.info("Tournament matches table checked/created successfully.");
            }
        });


        db.run(`
           CREATE TABLE IF NOT EXISTS friends (
               user_id INTEGER NOT NULL,
               friend_id INTEGER NOT NULL,
               PRIMARY KEY (user_id, friend_id),
               FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
               FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
           )
`       , (err) => {
           if (err) {
               if (logger) logger.error({ err }, "Error creating friends table");
           } else {
               if (logger) logger.info("Friends table checked/created successfully.");
           }
        });

        
    });

    dbInstance = db;
    return dbInstance;
}

export function getDB() {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call initializeDB first.");
    }
    return dbInstance;
}