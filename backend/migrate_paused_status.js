// backend/migrate_paused_status.js
const db = require('./database.js'); // Adjust path if necessary, assuming it's in the same backend folder

async function migratePausedToEmEspera() {
    console.log('Starting migration: "Pausado" to "Em Espera"...');

    try {
        const sql = "UPDATE tickets SET status = 'Em Espera' WHERE status = 'Pausado'";

        // db.run does not return rows, but provides this.changes
        await new Promise((resolve, reject) => {
            db.run(sql, [], function(err) { // Use function() to access this.changes
                if (err) {
                    console.error('Error updating ticket statuses:', err.message);
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        console.log(`Successfully updated ${this.changes} tickets from "Pausado" to "Em Espera".`);
                    } else {
                        console.log('No tickets found with status "Pausado" to update.');
                    }
                    resolve();
                }
            });
        });

        console.log('Migration process finished.');

    } catch (error) {
        console.error('Error during status migration:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database connection:', err.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

// Run the migration
migratePausedToEmEspera();
