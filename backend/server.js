// backend/server.js
const express = require('express');
const cors = require('cors');
const db = require('./database.js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// GET /api/tickets - Listar todos os tickets
app.get("/api/tickets", (req, res) => {
    const sql = "SELECT * FROM tickets ORDER BY createdAt DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        const tickets = rows.map(row => ({
            ...row,
            isActive: !!row.isActive,
            log: row.log ? JSON.parse(row.log) : [],
            checklist: row.checklist ? JSON.parse(row.checklist) : { respondeuTicket: false, respondeuPlanilha: false }
        }));
        res.json({
            "message": "success",
            "data": tickets
        });
    });
});

// GET /api/tickets/:id - Obter um ticket específico
app.get("/api/tickets/:id", (req, res) => {
    const sql = "SELECT * FROM tickets WHERE id = ?";
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (row) {
            res.json({
                "message": "success",
                "data": {
                    ...row,
                    isActive: !!row.isActive,
                    log: row.log ? JSON.parse(row.log) : [],
                    checklist: row.checklist ? JSON.parse(row.checklist) : { respondeuTicket: false, respondeuPlanilha: false }
                }
            });
        } else {
            res.status(404).json({ "message": "Ticket não encontrado" });
        }
    });
});

// POST /api/tickets - Criar um novo ticket
app.post("/api/tickets", (req, res) => {
    const {
        ticketIdInput, subject, accountName, priority, difficulty,
        creationTime, status = 'Pendente', elapsedTime = 0, isActive = false,
        log = [], checklist = { respondeuTicket: false, respondeuPlanilha: false },
        currentTimerStartTime = null // Adicionado para consistência
    } = req.body;

    if (!subject) {
        res.status(400).json({ "error": "O campo 'subject' é obrigatório" });
        return;
    }

    const newId = uuidv4();
    const nowISO = new Date().toISOString();

    const sql = `INSERT INTO tickets (
        id, ticketIdInput, subject, accountName, priority, difficulty, 
        creationTime, status, elapsedTime, isActive, log, checklist, 
        currentTimerStartTime, lastUpdatedAt, createdAt
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    
    const params = [
        newId, ticketIdInput || `T-${Date.now().toString().slice(-6)}`, subject, accountName, 
        priority, difficulty, creationTime || nowISO, status, elapsedTime, 
        isActive ? 1 : 0, JSON.stringify(log), JSON.stringify(checklist),
        currentTimerStartTime, // Pode ser null
        nowISO, // lastUpdatedAt
        nowISO  // createdAt
    ];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        // Retorna o objeto completo do ticket criado
        const createdTicket = {
            id: newId,
            ticketIdInput: params[1], subject, accountName, priority, difficulty,
            creationTime: params[6], status, elapsedTime, isActive, log, checklist,
            currentTimerStartTime: params[12],
            lastUpdatedAt: nowISO,
            createdAt: nowISO
        };
        res.status(201).json({
            "message": "success",
            "data": createdTicket,
            "id": newId
        });
    });
});

// PUT /api/tickets/:id - Atualizar um ticket existente
app.put("/api/tickets/:id", (req, res) => {
    const id = req.params.id;
    const {
        ticketIdInput, subject, accountName, priority, difficulty, creationTime,
        status, elapsedTime, isActive, log, checklist, currentTimerStartTime
    } = req.body;
    
    const lastUpdatedAt = new Date().toISOString();

    let fieldsToUpdate = [];
    let updateParams = [];

    // Helper para adicionar campos à atualização
    const addField = (fieldName, value) => {
        if (value !== undefined) {
            fieldsToUpdate.push(`${fieldName} = ?`);
            if (typeof value === 'boolean') {
                updateParams.push(value ? 1 : 0);
            } else if (typeof value === 'object' && value !== null) {
                updateParams.push(JSON.stringify(value));
            } else {
                updateParams.push(value);
            }
        }
    };

    addField("ticketIdInput", ticketIdInput);
    addField("subject", subject);
    addField("accountName", accountName);
    addField("priority", priority);
    addField("difficulty", difficulty);
    addField("creationTime", creationTime);
    addField("status", status);
    addField("elapsedTime", elapsedTime);
    addField("isActive", isActive);
    addField("log", log);
    addField("checklist", checklist);
    addField("currentTimerStartTime", currentTimerStartTime); // Pode ser null intencionalmente

    if (fieldsToUpdate.length === 0) {
        res.status(400).json({ "error": "Nenhum campo fornecido para atualização" });
        return;
    }

    fieldsToUpdate.push("lastUpdatedAt = ?");
    updateParams.push(lastUpdatedAt);
    updateParams.push(id); // Para a cláusula WHERE

    const sql = `UPDATE tickets SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;

    db.run(sql, updateParams, function (err) {
        if (err) {
            console.error("Erro ao atualizar ticket:", err.message, "SQL:", sql, "Params:", updateParams);
            res.status(500).json({ "error": err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ "message": "Ticket não encontrado para atualização" });
            return;
        }
        // Busca o ticket atualizado para retornar
        db.get("SELECT * FROM tickets WHERE id = ?", [id], (err, row) => {
            if (err) {
                res.status(500).json({ "error": err.message });
                return;
            }
            res.json({
                message: "success",
                data: {
                    ...row,
                    isActive: !!row.isActive,
                    log: row.log ? JSON.parse(row.log) : [],
                    checklist: row.checklist ? JSON.parse(row.checklist) : { respondeuTicket: false, respondeuPlanilha: false }
                },
                changes: this.changes
            });
        });
    });
});

// DELETE /api/tickets/:id - Deletar um ticket
app.delete("/api/tickets/:id", (req, res) => {
    const sql = 'DELETE FROM tickets WHERE id = ?';
    db.run(sql, req.params.id, function (err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ "message": "Ticket não encontrado para deletar" });
            return;
        }
        res.json({ "message": "deleted", id: req.params.id, changes: this.changes });
    });
});

// CRUD de clientes (clients)
// GET /api/clients - Listar todos os clientes
app.get('/api/clients', (req, res) => {
    db.all('SELECT * FROM clients ORDER BY name ASC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'success', data: rows });
    });
});

// POST /api/clients - Criar novo cliente
app.post('/api/clients', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        res.status(400).json({ error: "O campo 'name' é obrigatório" });
        return;
    }
    const id = require('uuid').v4();
    db.run('INSERT INTO clients (id, name) VALUES (?, ?)', [id, name.trim()], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({ message: 'success', data: { id, name: name.trim() } });
    });
});

// DELETE /api/clients/:id - Remover cliente
app.delete('/api/clients/:id', (req, res) => {
    db.run('DELETE FROM clients WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'success', deleted: this.changes });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor backend rodando na porta ${PORT}`);
    console.log(`Acesse a API em http://localhost:${PORT}/api/tickets`);
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Conexão com o banco de dados SQLite fechada.');
        process.exit(0);
    });
});