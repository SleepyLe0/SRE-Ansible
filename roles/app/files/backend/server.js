const express = require('express');
const mysql = require('mysql2/promise');
const promClient = require('prom-client');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Prometheus Metrics Setup
const register = new promClient.Registry();

// Default metrics (CPU, memory, Node.js internals, GC, event loop)
promClient.collectDefaultMetrics({ register });

// Custom metrics matching your existing schema
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const httpRequestsErrorsTotal = new promClient.Counter({
  name: 'http_requests_errors_total',
  help: 'Total failed HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const activeRequests = new promClient.Gauge({
  name: 'active_requests',
  help: 'Number of active requests'
});

const dbQueriesTotal = new promClient.Counter({
  name: 'db_queries_total',
  help: 'Total database queries',
  labelNames: ['operation', 'table']
});

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5]
});

const dbQueryErrorsTotal = new promClient.Counter({
  name: 'db_query_errors_total',
  help: 'Total failed database queries',
  labelNames: ['operation', 'table']
});

const dbActiveConnections = new promClient.Gauge({
  name: 'db_active_connections',
  help: 'Number of active database connections'
});

// Register all metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsErrorsTotal);
register.registerMetric(activeRequests);
register.registerMetric(dbQueriesTotal);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbQueryErrorsTotal);
register.registerMetric(dbActiveConnections);

// Database connection pool
let pool;

async function initDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'database',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'appuser',
      password: process.env.DB_PASSWORD || 'apppassword',
      database: process.env.DB_NAME || 'students_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');

    // Create table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        major VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Students table created/verified');
    connection.release();
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
}

// Helper function to execute DB queries with metrics
async function executeQuery(sql, params, operation, table) {
  const startTime = Date.now();
  try {
    const [result] = await pool.query(sql, params);
    const duration = (Date.now() - startTime) / 1000;

    // Record metrics
    dbQueriesTotal.labels(operation, table).inc();
    dbQueryDuration.labels(operation, table).observe(duration);

    return result;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    dbQueryDuration.labels(operation, table).observe(duration);
    dbQueryErrorsTotal.labels(operation, table).inc();
    throw error;
  }
}

// Middleware to track request metrics
app.use((req, res, next) => {
  const start = Date.now();
  activeRequests.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();

    // Track errors separately
    if (res.statusCode >= 500) {
      httpRequestsErrorsTotal
        .labels(req.method, route, res.statusCode.toString())
        .inc();
    }

    activeRequests.dec();
  });

  next();
});

// Update active connections gauge periodically
setInterval(async () => {
  if (pool) {
    try {
      const [rows] = await pool.query('SHOW STATUS LIKE "Threads_connected"');
      if (rows.length > 0) {
        dbActiveConnections.set(parseInt(rows[0].Value) || 0);
      }
    } catch (error) {
      // Silently fail
    }
  }
}, 5000);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint for Prometheus (matching your /api/metrics path)
app.get('/api/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Also support /metrics for compatibility
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// API Routes

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM students ORDER BY created_at DESC',
      [],
      'select',
      'students'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get student by ID
app.get('/api/students/:id', async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM students WHERE id = ?',
      [req.params.id],
      'select',
      'students'
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create new student
app.post('/api/students', async (req, res) => {
  try {
    const { name, email, major } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required' });
    }

    const result = await executeQuery(
      'INSERT INTO students (name, email, major) VALUES (?, ?, ?)',
      [name, email, major],
      'insert',
      'students'
    );

    res.status(201).json({
      success: true,
      data: { id: result.insertId, name, email, major }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    console.error('Error creating student:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  try {
    const { name, email, major } = req.body;
    const { id } = req.params;

    const result = await executeQuery(
      'UPDATE students SET name = ?, email = ?, major = ? WHERE id = ?',
      [name, email, major, id],
      'update',
      'students'
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    res.json({ success: true, data: { id, name, email, major } });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const result = await executeQuery(
      'DELETE FROM students WHERE id = ?',
      [req.params.id],
      'delete',
      'students'
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Mock error endpoint (matching your /api/mock-error)
app.get('/api/mock-error', (req, res) => {
  res.status(500).json({ success: false, error: 'Simulated error for testing' });
});

// Also support simulate-error for compatibility
app.get('/api/simulate-error', (req, res) => {
  res.status(500).json({ success: false, error: 'Simulated error for testing' });
});

// Simulate slow endpoint (for testing latency alerts)
app.get('/api/simulate-slow', async (req, res) => {
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  res.json({ success: true, message: 'This was a slow response' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'INT531 Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      metrics: '/api/metrics',
      students: '/api/students',
      mock_error: '/api/mock-error',
      simulate_slow: '/api/simulate-slow'
    }
  });
});

// Start server
async function startServer() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 Backend API server running on port ${PORT}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/api/metrics`);
    console.log(`❤️  Health check at http://localhost:${PORT}/health`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
