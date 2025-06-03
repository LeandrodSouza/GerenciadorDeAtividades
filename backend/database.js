// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs'); // Para criar o diretório

// Caminho para o diretório de dados e o arquivo do banco de dados
const dataDir = path.join(__dirname, 'data');
const DBSOURCE = path.join(dataDir, 'tickets.sqlite');

// Cria o diretório 'data' se ele não existir
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Diretório criado: ${dataDir}`);
}


const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(`Erro ao abrir/criar banco de dados em ${DBSOURCE}:`, err.message);
        throw err;
    } else {
        console.log(`Conectado ao banco de dados SQLite em ${DBSOURCE}`);
        db.run(`CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            ticketIdInput TEXT,
            subject TEXT NOT NULL,
            accountName TEXT,
            priority TEXT,
            difficulty TEXT,
            creationTime TEXT NOT NULL, -- Armazenar como ISO String
            status TEXT NOT NULL,
            elapsedTime INTEGER DEFAULT 0,
            isActive INTEGER DEFAULT 0, 
            log TEXT, 
            checklist TEXT, 
            currentTimerStartTime TEXT, -- Armazenar como ISO String ou null
            lastUpdatedAt TEXT NOT NULL, -- Armazenar como ISO String
            createdAt TEXT NOT NULL, -- Armazenar como ISO String
            clientId TEXT,
            FOREIGN KEY (clientId) REFERENCES clients(id)
        )`, (err) => {
            if (err) {
                console.log('Erro ao criar tabela tickets:', err.message);
            } else {
                console.log('Tabela "tickets" pronta ou já existente.');
                // Attempt to add the column if it doesn't exist (for existing databases)
                db.run(`ALTER TABLE tickets ADD COLUMN clientId TEXT REFERENCES clients(id)`, (alterErr) => {
                    if (alterErr && !alterErr.message.includes('duplicate column name')) {
                        console.log('Erro ao adicionar coluna clientId à tabela tickets:', alterErr.message);
                        // If adding with REFERENCES fails, try adding just the column
                        // This might happen if SQLite version doesn't support adding FK this way directly
                        if (alterErr.message.includes('Cannot add a REFERENCES clause')) {
                            db.run(`ALTER TABLE tickets ADD COLUMN clientId TEXT`, (addColErr) => {
                                if (addColErr && !addColErr.message.includes('duplicate column name')) {
                                    console.log('Erro ao adicionar coluna clientId (sem FK) à tabela tickets:', addColErr.message);
                                } else if (!addColErr || addColErr.message.includes('duplicate column name')) {
                                    console.log('Coluna clientId adicionada (sem FK) ou já existente.');
                                    console.log('AVISO: Foreign key para clientId pode precisar ser criada manualmente se ALTER TABLE com REFERENCES falhou.');
                                }
                            });
                        }
                    } else if (!alterErr || alterErr.message.includes('duplicate column name')) {
                        console.log('Coluna clientId (com FK) adicionada ou já existente na tabela tickets.');
                    }
                });
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )`, (err) => {
            if (err) {
                console.log('Erro ao criar tabela clients:', err.message);
            } else {
                console.log('Tabela "clients" pronta ou já existente.');
            }
        });
    }
});

module.exports = db;