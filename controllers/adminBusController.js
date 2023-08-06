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
        // Check if bus name already exists
        const checkQuery = {
            text: 'SELECT * FROM bus_services WHERE bus_name = $1',
            values: [busName]
        };
        const checkResult = await pool.query(checkQuery);
        if (checkResult.rows.length > 0) {
            console.log("Bus name already exists");
            return res.status(400).json({ message: 'Bus name already exists' });
        }
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

// Get Bus Info
const getBusInfo = async (req, res) => {
    try {
        console.log("getBusInfo called from bus-service");
        const query = {
            text: 'SELECT * FROM bus_services'
        };
        const result = await pool.query(query);
        const busInfo = result.rows;
        console.log(busInfo);
        res.status(200).json(busInfo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Add bus layout info with bus id, coach id and layout details
const addBusLayoutInfo = async (req, res) => {
    try {
        console.log("addBusLayoutInfo called from bus-service");
        console.log(req.body);
        const {busId, coachId, numberOfSeats, matrix, matrixRows, matrixCols} = req.body;
        

        const query = {
            text: 'INSERT INTO bus_layout (bus_id, coach_id, number_of_seats, matrix_rows, matrix_cols) VALUES ($1, $2, $3, $4, $5)',
            values: [busId, coachId, numberOfSeats, matrixRows, matrixCols]
        };
        await pool.query(query);
        console.log("Bus layout added");

        // Get the bus layout id
        const getQuery = {
            text: 'SELECT * FROM bus_layout WHERE bus_id = $1 AND coach_id = $2',
            values: [busId, coachId]
        };
        const getResult = await pool.query(getQuery);
        const busLayoutId = getResult.rows[0].bus_layout_id;

        // Add layout details
        for (let i = 0; i < matrixRows; i++) {
            for (let j = 0; j < matrixCols; j++) {
                const seat_name = ''
                if (matrix[i][j] !== 0) {
                    seat_name = String.fromCharCode(65 + i) + (j + 1);
                }
                const query = {
                    text: 'INSERT INTO bus_layout_details (bus_layout_id, seat_name, booked_status, is_seat, matrix_row_id, matrix_col_id) VALUES ($1, $2, $3, $4, $5, $6)',
                    values: [busLayoutId, seat_name, 0, matrix[i][j], i, j]
                };
                await pool.query(query);
            }
        }

        console.log("Bus layout details added");
        res.status(200).json({ message: 'Bus layout added' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}



module.exports = {
    addBusInfo,
    addCoachInfo,
    getCoachInfo,
    getBusInfo,
    addBusLayoutInfo
}