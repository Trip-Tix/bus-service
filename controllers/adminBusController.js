const { Pool } = require('pg');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const secretKey = process.env.SECRETKEY;

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
        const result = await pool.query(query);
        console.log("Bus added");
        console.log(result);
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
    // get the token
    // console.log(req)
    // const token = req.headers.authorization?.split(' ')[1];
    // if (!token) {
    //     return res.status(401).json({ message: 'No token provided' });
    // }
    // // verify the token
    // jwt.verify(token, secretKey, async (err, decoded) => {
    //     if (err) {
    //         return res.status(401).json({ message: 'Unauthorized access' });
    //     }
    // });
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
        // Begin transaction
        await pool.query('BEGIN');
        console.log("addBusLayoutInfo called from bus-service");
        console.log(req.body);
        const {busId, coachId, numberOfSeats, matrix, matrixRows, matrixCols} = req.body;
        
        // Check if bus layout already exists
        const checkQuery = {
            text: 'SELECT * FROM bus_layout_info WHERE bus_id = $1 AND coach_id = $2',
            values: [busId, coachId]
        };
        const checkResult = await pool.query(checkQuery);
        if (checkResult.rows.length > 0) {
            console.log("Bus layout already exists");
            return res.status(400).json({ message: 'Bus layout already exists' });
        }

        // Add bus layout info
        const query = {
            text: 'INSERT INTO bus_layout_info (bus_id, coach_id, number_of_seats, matrix_rows, matrix_cols) VALUES ($1, $2, $3, $4, $5)',
            values: [busId, coachId, numberOfSeats, matrixRows, matrixCols]
        };
        await pool.query(query);
        console.log("Bus layout added");

        // Get the bus layout id
        const getQuery = {
            text: 'SELECT * FROM bus_layout_info WHERE bus_id = $1 AND coach_id = $2',
            values: [busId, coachId]
        };
        const getResult = await pool.query(getQuery);
        const busLayoutId = getResult.rows[0].bus_layout_id;

        // Add layout details
        for (let i = 0; i < matrixRows; i++) {
            let colCount = 0;
            for (let j = 0; j < matrixCols; j++) {
                let seat_name = ''
                if (matrix[i][j] !== 0) {
                    seat_name = String.fromCharCode(65 + i) + (colCount + 1);
                    colCount++;
                }
                const query = {
                    text: 'INSERT INTO bus_seat_details (bus_layout_id, seat_name, booked_status, is_seat, matrix_row_id, matrix_col_id) VALUES ($1, $2, $3, $4, $5, $6)',
                    values: [busLayoutId, seat_name, 0, matrix[i][j], i, j]
                };
                await pool.query(query);
            }
        }

        console.log("Bus layout details added");
        res.status(200).json({ message: 'Bus layout added' });
    } catch (error) {
        console.log(error);
        // Rollback transaction
        await pool.query('ROLLBACK');
        res.status(500).json({ message: error.message });
    } finally {
        // End transaction
        await pool.query('COMMIT');
    }
}

// Add bus schedule info with bus id, source, destination, departure time, arrival time, fare and date
const addBusScheduleInfo = async (req, res) => {
    try {
        // Begin transaction
        await pool.query('BEGIN');
        console.log("addBusScheduleInfo called from bus-service");

        /*
        {
        "schedule" : [
            {
                "date" : "07-08-2023",
                "timeWiseInfo" : [
                    {
                        "departureTime" : "8:10 AM",
                        "arrivingTime" : "12:00 PM",
                        "coachId" : 103,
                        "fare" : 400,
                        "source" : "Dhaka",
                        "destination" : "Mymensingh"
                    } , 
                    {
                        "departureTime" : "9:00 AM",
                        "arrivingTime" : "",
                        "coachId" : 103,
                        "fare" : 400,
                        "source" : "Dhaka",
                        "destination" : "Mymensingh"
                    }
                ]
            }, 
            {
                "date" : "08-08-2023",
                "timeWiseInfo" : [
                    {
                        "departureTime" : "9:00 AM",
                        "arrivingTime" : "",
                        "coachId" : 102,
                        "fare" : 300,
                        "source" : "Dhaka",
                        "destination" : "Jamalpur"
                    } , 
                    {
                        "departureTime" : "10:00 AM",
                        "arrivingTime" : "3:00 PM",
                        "coachId" : 100,
                        "fare" : 500,
                        "source" : "Dhaka",
                        "destination" : "Kishoreganj"
                    }
                ]
            }
        ],
        "busId" : 100
        }
        */
        
        const {schedule, busId} = req.body;
        for (let i = 0; i < schedule.length; i++) {
            const {date, timeWiseInfo} = schedule[i];
            for (let j = 0; j < timeWiseInfo.length; j++) {
                const {departureTime, arrivingTime, coachId, fare, source, destination} = timeWiseInfo[j];
                // Check if bus schedule already exists
                const checkQuery = {
                    text: 'SELECT * FROM bus_schedule_info WHERE bus_id = $1 AND source = $2 AND destination = $3 AND departure_time = $4 AND coach_id = $5 AND schedule_date = $6',
                    values: [busId, source, destination, departureTime, coachId, date]
                };
                const checkResult = await pool.query(checkQuery);
                if (checkResult.rows.length > 0) {
                    console.log("Bus schedule already exists");

                    // Rollback transaction
                    await pool.query('ROLLBACK');
                    return res.status(400).json({ message: 'Bus schedule already exists' });
                }
                
                // Check if bus layout exists
                const checkQuery2 = {
                    text: 'SELECT * FROM bus_layout_info WHERE bus_id = $1 AND coach_id = $2',
                    values: [busId, coachId]
                };
                const checkResult2 = await pool.query(checkQuery2);
                if (checkResult2.rows.length === 0) {
                    console.log("Bus layout does not exist");
                    return res.status(400).json({ message: 'Bus layout does not exist' });
                }

                // Get the bus layout id
                const busLayoutId = checkResult2.rows[0].bus_layout_id;

                // Add bus schedule info
                const query = {
                    text: 'INSERT INTO bus_schedule_info (bus_id, source, destination, departure_time, arrival_time, bus_fare, coach_id, schedule_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    values: [busId, source, destination, departureTime, arrivingTime, fare, coachId, date]
                };
                await pool.query(query);
                console.log("Bus schedule added");

                // Get the bus schedule id
                const getQuery = {
                    text: 'SELECT * FROM bus_schedule_info WHERE bus_id = $1 AND source = $2 AND destination = $3 AND departure_time = $4 AND coach_id = $5 AND schedule_date = $6',
                    values: [busId, source, destination, departureTime, coachId, date]
                };
                const getResult = await pool.query(getQuery);
                const busScheduleId = getResult.rows[0].bus_schedule_id;

                // Insert into bus schedule seat info table with bus schedule id and bus layout id and the seat details selecting from seat details table with bus layout id
                const insertQuery = {
                    text: 'INSERT INTO bus_schedule_seat_info (bus_schedule_id, bus_layout_id, bus_seat_id, seat_status) SELECT $1, $2, bus_seat_id, booked_status FROM bus_seat_details WHERE bus_layout_id = $3 and is_seat = 1',
                    values: [busScheduleId, busLayoutId, busLayoutId]
                };
                await pool.query(insertQuery);
                console.log("Bus schedule seat info added");
            }
        }

        console.log("Bus schedule details added");
        res.status(200).json({ message: 'Bus schedule added' });
    } catch (error) {
        console.log(error);
        // Rollback transaction
        await pool.query('ROLLBACK');
        res.status(500).json({ message: error.message });
    } finally {
        // End transaction
        await pool.query('COMMIT');
    }
}

// Get schedule wise bus details: bus name, coach name, source, destination, departure time, bus fare from bus schedule info table, bus info table, coach info table
const getScheduleWiseBusDetails = async (req, res) => {
    try {
        console.log("getScheduleWiseBusDetails called from bus-service");
        const query = {
            text: 'SELECT bus_schedule_info.bus_schedule_id, bus_services.bus_name, coach_info.coach_name, bus_schedule_info.source, bus_schedule_info.destination, bus_schedule_info.departure_time, bus_schedule_info.arrival_time, bus_schedule_info.bus_fare, bus_schedule_info.schedule_date FROM bus_schedule_info INNER JOIN bus_services ON bus_schedule_info.bus_id = bus_services.bus_id INNER JOIN coach_info ON bus_schedule_info.coach_id = coach_info.coach_id'
        };
        const result = await pool.query(query);
        console.log("Schedule wise bus details fetched");
        res.status(200).json(result.rows);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
}


module.exports = {
    addBusInfo,
    addCoachInfo,
    getCoachInfo,
    getBusInfo,
    addBusLayoutInfo,
    addBusScheduleInfo,
    getScheduleWiseBusDetails
}