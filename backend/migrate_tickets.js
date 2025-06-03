// backend/migrate_tickets.js
const db = require('./database.js'); // Adjust path if necessary
const { v4: uuidv4 } = require('uuid');

async function migrateTickets() {
    console.log('Starting migration process for tickets...');

    try {
        // Get all tickets that don't have a clientId or where clientId is NULL or empty
        const ticketsToMigrate = await new Promise((resolve, reject) => {
            db.all("SELECT id, accountName FROM tickets WHERE clientId IS NULL OR clientId = ''", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (ticketsToMigrate.length === 0) {
            console.log('No tickets found needing migration.');
            return;
        }

        console.log(`Found ${ticketsToMigrate.length} tickets to migrate.`);
        let ticketsUpdatedCount = 0;
        let clientsCreatedCount = 0;

        for (const ticket of ticketsToMigrate) {
            if (!ticket.accountName || ticket.accountName.trim() === '') {
                console.log(`Ticket ID ${ticket.id} has no accountName, skipping.`);
                continue;
            }

            const accountNameUpper = ticket.accountName.trim().toUpperCase();
            let clientIdToSet = null;

            // 1. Check if client exists
            let client = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM clients WHERE name = ?", [accountNameUpper], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (client) {
                clientIdToSet = client.id;
            } else {
                // 2. If client does not exist, create it
                const newClientId = uuidv4();
                await new Promise((resolve, reject) => {
                    db.run("INSERT INTO clients (id, name) VALUES (?, ?)", [newClientId, accountNameUpper], function(err) {
                        if (err) {
                            // It's possible another async operation created it in the meantime
                            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                                console.warn(`Client '${accountNameUpper}' likely created by concurrent operation. Will try to fetch again.`);
                                // Try to fetch the client again
                                db.get("SELECT id FROM clients WHERE name = ?", [accountNameUpper], (errFetch, rowFetch) => {
                                    if (errFetch) reject(errFetch);
                                    else if (!rowFetch) reject(new Error(`Failed to create or find client ${accountNameUpper} after UNIQUE constraint warning.`));
                                    else {
                                        clientIdToSet = rowFetch.id;
                                        // Not incrementing clientsCreatedCount here as it was a concurrent creation
                                        resolve();
                                    }
                                });
                                return;
                            }
                            reject(err);
                        } else {
                            clientIdToSet = newClientId;
                            clientsCreatedCount++;
                            console.log(`Created new client: '${accountNameUpper}' (ID: ${newClientId})`);
                            resolve();
                        }
                    });
                });
                 // If client was created due to constraint failure and re-fetch, clientIdToSet would be updated.
                 // Ensure it's set for the update.
                if (!clientIdToSet) { // If after attempting insert and potential re-fetch, still no ID
                     const refetchedClient = await new Promise((resolve, reject) => {
                        db.get("SELECT id FROM clients WHERE name = ?", [accountNameUpper], (err, row) => {
                            if (err) reject(err); else resolve(row);
                        });
                    });
                    if (refetchedClient) {
                        clientIdToSet = refetchedClient.id;
                        // This path indicates the client was created concurrently, so we found it on refetch.
                        // We don't increment clientsCreatedCount because this specific operation didn't complete the INSERT successfully first.
                    } else {
                        console.error(`Failed to secure a clientId for account name ${accountNameUpper} for ticket ${ticket.id}. Skipping update for this ticket.`);
                        continue; // Skip to next ticket
                    }
                }
            }

            // 3. Update ticket with clientId
            if (clientIdToSet) {
                await new Promise((resolve, reject) => {
                    db.run("UPDATE tickets SET clientId = ? WHERE id = ?", [clientIdToSet, ticket.id], function(err) {
                        if (err) reject(err);
                        else {
                            if (this.changes > 0) {
                                console.log(`Updated ticket ID ${ticket.id} with clientId ${clientIdToSet} (Client: ${accountNameUpper}).`);
                                ticketsUpdatedCount++;
                            }
                            resolve();
                        }
                    });
                });
            } else {
                 console.warn(`Could not determine clientId for ticket ID ${ticket.id} (Account: ${ticket.accountName}). Skipping.`);
            }
        }

        console.log('Migration process finished.');
        console.log(`Total tickets checked: ${ticketsToMigrate.length}`);
        console.log(`Tickets updated with clientId: ${ticketsUpdatedCount}`);
        console.log(`New clients created: ${clientsCreatedCount}`);

    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        db.close((err) => {
            if (err) console.error('Error closing database:', err.message);
            else console.log('Database connection closed.');
        });
    }
}

// Run the migration
migrateTickets();
