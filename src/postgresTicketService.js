import { Pool } from 'pg';

// Configure connection pool using environment variables
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
});

// Helper to map PostgreSQL row to a JS ticket object
const rowToTicket = (row) => {
  if (!row) return null;
  return {
    ...row,
    id: String(row.id), // Ensure id is a string for consistency if needed by UI
    creation_time: new Date(row.creation_time),
    last_updated_at: new Date(row.last_updated_at),
    created_at: new Date(row.created_at),
    current_timer_start_time: row.current_timer_start_time ? new Date(row.current_timer_start_time) : null,
    // Ensure log and checklist are parsed if they are stored as JSON strings
    // pg library usually handles JSONB parsing automatically to JS objects
    log: typeof row.log === 'string' ? JSON.parse(row.log) : row.log,
    checklist: typeof row.checklist === 'string' ? JSON.parse(row.checklist) : row.checklist,
  };
};

// Helper to map JS ticket data to a structure suitable for SQL (subset of fields for insert/update)
// Note: id, creation_time, created_at, last_updated_at are often handled by DB or specific logic
const ticketToDbData = (ticketData) => {
  const data = { ...ticketData };
  delete data.id; // ID is serial or provided in WHERE clause

  // Convert dates to ISO strings for DB compatibility if not handled by pg driver
  if (data.creation_time instanceof Date) data.creation_time = data.creation_time.toISOString();
  if (data.current_timer_start_time instanceof Date) data.current_timer_start_time = data.current_timer_start_time.toISOString();
  else if (data.current_timer_start_time === null) data.current_timer_start_time = null;


  // Ensure log and checklist are stringified if pg driver doesn't handle objects for JSONB well
  if (typeof data.log !== 'string') data.log = JSON.stringify(data.log);
  if (typeof data.checklist !== 'string') data.checklist = JSON.stringify(data.checklist);
  
  return data;
};


export const addTicket = async (userId, ticketData) => {
  console.log("postgresTicketService.addTicket called with userId:", userId, "ticketData:", ticketData);
  const { ticket_id_input, subject, account_name, priority, difficulty, status, elapsed_time, is_active, log, checklist, current_timer_start_time } = ticketData;
  
  // created_at and last_updated_at have defaults in DB. creation_time also has a default.
  // If creation_time is provided, use it, otherwise let DB handle it.
  const query = `
    INSERT INTO tickets (user_id, ticket_id_input, subject, account_name, priority, difficulty, status, elapsed_time, is_active, log, checklist, current_timer_start_time ${ticketData.creation_time ? ', creation_time' : ''})
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12 ${ticketData.creation_time ? ', $13' : ''})
    RETURNING *;
  `;
  const values = [userId, ticket_id_input, subject, account_name, priority, difficulty, status || 'Pendente', elapsed_time || 0, is_active || false, JSON.stringify(log || []), JSON.stringify(checklist || { respondeuTicket: false, respondeuPlanilha: false }), current_timer_start_time || null];
  if (ticketData.creation_time) {
    values.push(ticketData.creation_time instanceof Date ? ticketData.creation_time.toISOString() : ticketData.creation_time);
  }

  try {
    const res = await pool.query(query, values);
    console.log("postgresTicketService.addTicket response:", res.rows[0]);
    return rowToTicket(res.rows[0]);
  } catch (error) {
    console.error('Error adding ticket to PostgreSQL:', error);
    throw error;
  }
};

export const getTicket = async (userId, ticketId) => {
  // Assuming ticketId is the SERIAL PRIMARY KEY 'id'
  console.log("postgresTicketService.getTicket called with userId:", userId, "ticketId:", ticketId);
  try {
    const res = await pool.query('SELECT * FROM tickets WHERE id = $1 AND user_id = $2', [ticketId, userId]);
    return rowToTicket(res.rows[0]);
  } catch (error) {
    console.error('Error getting ticket from PostgreSQL:', error);
    throw error;
  }
};

export const updateTicket = async (userId, ticketId, data) => {
  // Assuming ticketId is the SERIAL PRIMARY KEY 'id'
  console.log("postgresTicketService.updateTicket called with userId:", userId, "ticketId:", ticketId, "data:", data);
  
  // last_updated_at will be set to CURRENT_TIMESTAMP by DB trigger or manually here
  const updateData = { ...data, last_updated_at: new Date() }; // Ensure last_updated_at is fresh
  
  const { ticket_id_input, subject, account_name, priority, difficulty, creation_time, status, elapsed_time, is_active, log, checklist, current_timer_start_time, last_updated_at } = updateData;

  // Build query dynamically for fields that are actually provided
  const fields = [];
  const values = [];
  let paramCount = 1;

  const addField = (name, value) => {
    if (value !== undefined) {
      fields.push(`${name} = $${paramCount++}`);
      values.push(value);
    }
  };

  addField('ticket_id_input', ticket_id_input);
  addField('subject', subject);
  addField('account_name', account_name);
  addField('priority', priority);
  addField('difficulty', difficulty);
  addField('creation_time', creation_time instanceof Date ? creation_time.toISOString() : creation_time);
  addField('status', status);
  addField('elapsed_time', elapsed_time);
  addField('is_active', is_active);
  addField('log', typeof log === 'string' ? log : JSON.stringify(log));
  addField('checklist', typeof checklist === 'string' ? checklist : JSON.stringify(checklist));
  addField('current_timer_start_time', current_timer_start_time instanceof Date ? current_timer_start_time.toISOString() : (current_timer_start_time === null ? null : current_timer_start_time) );
  addField('last_updated_at', last_updated_at.toISOString());
  
  if (fields.length === 0) {
    console.warn("UpdateTicket called with no data to update for ticketId:", ticketId);
    return getTicket(userId, ticketId); // Or throw error, or return null
  }

  values.push(ticketId);
  values.push(userId);

  const query = `
    UPDATE tickets
    SET ${fields.join(', ')}
    WHERE id = $${paramCount++} AND user_id = $${paramCount++}
    RETURNING *;
  `;
  
  try {
    const res = await pool.query(query, values);
    console.log("postgresTicketService.updateTicket response:", res.rows[0]);
    return rowToTicket(res.rows[0]);
  } catch (error) {
    console.error('Error updating ticket in PostgreSQL:', error);
    throw error;
  }
};

export const deleteTicket = async (userId, ticketId) => {
  // Assuming ticketId is the SERIAL PRIMARY KEY 'id'
  console.log("postgresTicketService.deleteTicket called with userId:", userId, "ticketId:", ticketId);
  try {
    await pool.query('DELETE FROM tickets WHERE id = $1 AND user_id = $2', [ticketId, userId]);
    // No return value needed, or could return status
  } catch (error) {
    console.error('Error deleting ticket from PostgreSQL:', error);
    throw error;
  }
};

export const subscribeToTickets = (userId, onUpdate) => {
  console.log("postgresTicketService.subscribeToTickets called with userId:", userId);
  let isSubscribed = true; // To prevent updates if unsubscribed quickly

  const fetchTickets = async () => {
    try {
      const res = await pool.query('SELECT * FROM tickets WHERE user_id = $1 ORDER BY creation_time DESC', [userId]);
      if (isSubscribed) {
        const tickets = res.rows.map(rowToTicket);
        const currentActiveId = tickets.find(ticket => ticket.is_active)?.id || null;
        console.log("postgresTicketService.subscribeToTickets fetched tickets:", tickets.length, "activeId:", currentActiveId);
        onUpdate(tickets, currentActiveId);
      }
    } catch (error) {
      console.error('Error fetching tickets in subscribeToTickets:', error);
      // Optionally call onUpdate with an error or empty state
      if (isSubscribed) {
        onUpdate([], null, error);
      }
    }
  };

  fetchTickets(); // Fetch initial data

  // Return an empty unsubscribe function as real-time updates are removed
  return () => {
    console.log("postgresTicketService.subscribeToTickets unsubscribed for userId:", userId);
    isSubscribed = false;
  };
};

// It might be useful to export the pool for direct use in specific scenarios or for testing.
// export { pool as pgPool };

const postgresTicketService = {
  addTicket,
  getTicket,
  updateTicket,
  deleteTicket,
  subscribeToTickets,
};

export default postgresTicketService;
