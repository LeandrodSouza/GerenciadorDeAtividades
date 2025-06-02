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
            createdAt TEXT NOT NULL -- Armazenar como ISO String
        )`, (err) => {
            if (err) {
                console.log('Erro ao criar tabela tickets:', err.message);
            } else {
                console.log('Tabela "tickets" pronta ou já existente.');
            }
        });
    }
});

module.exports = db;