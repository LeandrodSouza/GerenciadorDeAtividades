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
    const sql = `
        SELECT t.*, c.name as clientName
        FROM tickets t
        LEFT JOIN clients c ON t.clientId = c.id
        ORDER BY t.createdAt DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        const tickets = rows.map(row => {
            const { clientName, ...ticketData } = row;
            return {
                ...ticketData,
                accountName: clientName, // Use the joined name
                isActive: !!row.isActive,
                log: row.log ? JSON.parse(row.log) : [],
                checklist: row.checklist ? JSON.parse(row.checklist) : { respondeuTicket: false, respondeuPlanilha: false }
            };
        });
        res.json({
            "message": "success",
            "data": tickets
        });
    });
});

// PUT /api/clients/:id - Atualizar cliente
app.put('/api/clients/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
        res.status(400).json({ error: "O campo 'name' é obrigatório para atualização" });
        return;
    }
    const upperCaseName = name.trim().toUpperCase();

    // Primeiro, verifique se outro cliente com o novo nome já existe
    db.get('SELECT id FROM clients WHERE name = ? AND id != ?', [upperCaseName, id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            // Outro cliente com este nome já existe
            res.status(409).json({ error: "Outro cliente com este nome já existe" });
            return;
        }

        // Se não houver conflito de nome, prossiga com a atualização
        const sql = 'UPDATE clients SET name = ? WHERE id = ?';
        db.run(sql, [upperCaseName, id], function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: "Cliente não encontrado para atualização" });
                return;
            }
            res.json({ message: 'success', data: { id: id, name: upperCaseName } });
        });
    });
});

// GET /api/tickets/:id - Obter um ticket específico
app.get("/api/tickets/:id", (req, res) => {
    const sql = `
        SELECT t.*, c.name as clientName
        FROM tickets t
        LEFT JOIN clients c ON t.clientId = c.id
        WHERE t.id = ?
    `;
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (row) {
            const { clientName, ...ticketData } = row;
            res.json({
                "message": "success",
                "data": {
                    ...ticketData,
                    accountName: clientName, // Use the joined name
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
        ticketIdInput, subject, clientId, /* accountName is removed */ priority, difficulty,
        creationTime, status = 'Pendente', elapsedTime = 0, isActive = false,
        log = [], checklist = { respondeuTicket: false, respondeuPlanilha: false },
        currentTimerStartTime = null
    } = req.body;

    if (!subject) {
        res.status(400).json({ "error": "O campo 'subject' é obrigatório" });
        return;
    }
    if (!clientId) { // Make clientId mandatory
        res.status(400).json({ "error": "O campo 'clientId' é obrigatório" });
        return;
    }

    const newId = uuidv4();
    const nowISO = new Date().toISOString();

    const sql = `INSERT INTO tickets (
        id, ticketIdInput, subject, priority, difficulty,
        creationTime, status, elapsedTime, isActive, log, checklist, 
        currentTimerStartTime, lastUpdatedAt, createdAt, clientId
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`; // 15 params, accountName removed
    
    const params = [
        newId, ticketIdInput || `T-${Date.now().toString().slice(-6)}`, subject,
        priority, difficulty, creationTime || nowISO, status, elapsedTime, 
        isActive ? 1 : 0, JSON.stringify(log), JSON.stringify(checklist),
        currentTimerStartTime, nowISO, nowISO, clientId // clientId added
    ];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        // Fetch client name for the response
        db.get("SELECT name FROM clients WHERE id = ?", [clientId], (clientErr, clientRow) => {
            // Not critical if client fetch fails for response, but log it.
            // The ticket is created, GET requests will handle joins.
            if (clientErr) {
                console.error("Error fetching client name for POST response:", clientErr.message);
            }

            const createdTicket = {
                id: newId,
                ticketIdInput: params[1], // ticketIdInput from params
                subject,
                clientId, // Include clientId
                accountName: clientRow ? clientRow.name : "Cliente não encontrado", // Add accountName from join/fetch
                priority, difficulty,
                creationTime: params[5], // creationTime from params
                status, elapsedTime, isActive, log, checklist,
                currentTimerStartTime: params[11], // currentTimerStartTime from params
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
});

// PUT /api/tickets/:id - Atualizar um ticket existente
app.put("/api/tickets/:id", (req, res) => {
    const id = req.params.id;
    const {
        ticketIdInput, subject, clientId, /* accountName removed */ priority, difficulty, creationTime,
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
    addField("clientId", clientId); // Added clientId
    addField("priority", priority);
    addField("difficulty", difficulty);
    addField("creationTime", creationTime);
    addField("status", status);
    addField("elapsedTime", elapsedTime);
    addField("isActive", isActive);
    addField("log", log);
    addField("checklist", checklist);
    addField("currentTimerStartTime", currentTimerStartTime);

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
    const upperCaseName = name.trim().toUpperCase(); // Transform to uppercase
    const id = require('uuid').v4();

    // Check if client with the same uppercase name already exists
    db.get('SELECT * FROM clients WHERE name = ?', [upperCaseName], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            // Client with this name already exists
            res.status(409).json({ error: "Cliente com este nome já existe", client: row });
            return;
        }

        // Proceed to insert if no duplicate found
        db.run('INSERT INTO clients (id, name) VALUES (?, ?)', [id, upperCaseName], function (err) {
            if (err) {
                // Check for SQLite UNIQUE constraint error (SQLITE_CONSTRAINT_UNIQUE)
                if (err.message && err.message.includes('UNIQUE constraint failed: clients.name')) {
                     // This is an extra check, the db.get should catch most cases
                    res.status(409).json({ error: "Cliente com este nome já existe (constraint)" });
                } else {
                    res.status(500).json({ error: err.message });
                }
                return;
            }
            res.status(201).json({ message: 'success', data: { id, name: upperCaseName } });
        });
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