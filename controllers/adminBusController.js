const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Connect to Postgres
const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect(err => {
    if (err) {
        console.error('connection error', err.stack);
    } else {
        console.log('connected to database');
    }
});

// Add bus info with bus name, number of buses and coach info
const addBusInfo = async (req, res) => {
    try {
        console.log("addBusInfo called from bus-service");
        console.log(req.body);
        const {busName, numberOfBus, coachInfo} = req.body;
        const query = {
            text: 'INSERT INTO bus_services (bus_name, number_of_buses, coaches_info) VALUES ($1, $2, $3)',
            values: [busName, numberOfBus, coachInfo]
        };
        await pool.query(query);
        console.log("Bus added");
        res.status(200).json({ message: 'Bus added' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Add coach info with coach name
const addCoachInfo = async (req, res) => {
    try {
        console.log("addCoachInfo called from bus-service");
        console.log(req.body);
        const {coachName} = req.body;
        const query = {
            text: 'INSERT INTO coach_info (coach_name) VALUES ($1)',
            values: [coachName]
        };
        await pool.query(query);
        console.log("Coach added");
        res.status(200).json({ message: 'Coach added' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Get Coach Info
const getCoachInfo = async (req, res) => {
    try {
        console.log("getCoachInfo called from bus-service");
        const query = {
            text: 'SELECT * FROM coach_info'
        };
        const result = await pool.query(query);
        const coachInfo = result.rows;
        console.log(coachInfo);
        res.status(200).json(coachInfo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


module.exports = {
    addBusInfo,
    addCoachInfo,
    getCoachInfo
}