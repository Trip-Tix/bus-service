const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const busPool = require('../config/busDB.js');
const accountPool = require('../config/accountDB.js');

dotenv.config();

const secretKey = process.env.SECRETKEY;

// Add bus info with bus name, number of buses and coach info
const addBusInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const { token, busCompanyName, coachId, brandName, alreadyExist, layout, row, col, numBus, uniqueBusId, numSeat, facilities } = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                // Begin transaction
                await busPool.query('BEGIN');
                console.log("addBusInfo called from bus-service");
                console.log(req.body);
                const numberOfSeats = numSeat;

                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Get the brand id from brand name
                const brandIdQuery = {
                    text: 'SELECT brand_name_id FROM brand_name_info WHERE brand_name = $1',
                    values: [brandName]
                };
                const brandNameIdResult = await busPool.query(brandIdQuery);
                let brandNameId = 0;
                if (brandNameIdResult.rows.length === 0) {
                    // Insert into brand name info table
                    const brandNameInsertQuery = {
                        text: 'INSERT INTO brand_name_info (brand_name) VALUES ($1)',
                        values: [brandName]
                    };
                    await busPool.query(brandNameInsertQuery);
                    console.log("Brand Name Info added");

                    // Get the brand id
                    const brandIdQuery = {
                        text: 'SELECT brand_name_id FROM brand_name_info WHERE brand_name = $1',
                        values: [brandName]
                    };
                    const brandIdResult = await busPool.query(brandIdQuery);
                    brandNameId = brandIdResult.rows[0].brand_name_id;
                } else {
                    brandNameId = brandNameIdResult.rows[0].brand_name_id;
                }
                console.log("Brand id", brandNameId);

                if (alreadyExist) {
                    // Get the existing bus number
                    const busNumberQuery = {
                        text: 'SELECT number_of_bus, bus_coach_id FROM bus_coach_info WHERE bus_id = $1 AND coach_id = $2 AND brand_name_id = $3',
                        values: [busId, coachId, brandNameId]
                    };
                    const busNumberResult = await busPool.query(busNumberQuery);
                    let numberOfBus = busNumberResult.rows[0].number_of_bus;
                    const busCoachId = busNumberResult.rows[0].bus_coach_id;
                    console.log("Previous Number of Buses", numberOfBus);
                    numberOfBus += numBus;
                    console.log("New Number of Buses", numberOfBus);
                    const updateBusCoachQuery = {
                        text: 'UPDATE bus_coach_info SET number_of_bus = $1 WHERE bus_coach_id = $2',
                        values: [numberOfBus, busCoachId]
                    }; 
                    await busPool.query(updateBusCoachQuery);
                    console.log("Bus Coach Info updated");

                    // Insert into bus coach details table
                    for (let i = 0; i < numBus; i++) {
                        let uniqueId = uniqueBusId[i];
                        
                        const busCoachInsertQuery = {
                            text: 'INSERT INTO bus_coach_details (unique_bus_id, bus_id, coach_id, brand_name_id) VALUES ($1, $2, $3, $4)',
                            values: [uniqueId, busId, coachId, brandNameId]
                        };
                        await busPool.query(busCoachInsertQuery);
                    }
                    console.log("Bus Coach Details added");

                } else {
                    // Get the coach info from bus services table
                    const coachInfoQuery = {
                        text: 'SELECT coach_info FROM bus_services WHERE bus_id = $1',
                        values: [busId]
                    };
                    const coachInfoResult = await busPool.query(coachInfoQuery);
                    let coachInfo = coachInfoResult.rows[0].coach_info;
                    if (coachInfo === null) {
                        coachInfo = [];
                    }
                    coachInfo.push(coachId);

                    // Update the coach info in bus services table
                    const updateCoachInfoQuery = {
                        text: 'UPDATE bus_services SET coach_info = $1 WHERE bus_id = $2',
                        values: [coachInfo, busId]
                    };
                    await busPool.query(updateCoachInfoQuery);
                    console.log("Bus Services with new coach info updated");
                    
                    // Insert into bus coach info table
                    const busCoachInsertQuery = {
                        text: 'INSERT INTO bus_coach_info (bus_id, coach_id, brand_name_id, number_of_bus, facilities) VALUES ($1, $2, $3, $4, $5)',
                        values: [busId, coachId, brandNameId, numBus, facilities]
                    };
                    await busPool.query(busCoachInsertQuery);
                    console.log("Bus Coach Info added");

                    // Get the bus coach id
                    const busCoachIdQuery = {
                        text: 'SELECT bus_coach_id FROM bus_coach_info WHERE bus_id = $1 AND coach_id = $2 AND brand_name_id = $3',
                        values: [busId, coachId, brandNameId]
                    };
                    const busCoachIdResult = await busPool.query(busCoachIdQuery);
                    const busCoachId = busCoachIdResult.rows[0].bus_coach_id;
                    console.log("Bus Coach Id", busCoachId);

                    // Insert into bus coach details table
                    for (let i = 0; i < numBus; i++) {
                        let uniqueId = uniqueBusId[i];

                        const busCoachDetailsInsertQuery = {
                            text: 'INSERT INTO bus_coach_details (unique_bus_id, bus_id, coach_id, brand_name_id) VALUES ($1, $2, $3, $4)',
                            values: [uniqueId, busId, coachId, brandNameId]
                        };
                        await busPool.query(busCoachDetailsInsertQuery);
                    }
                    console.log("Bus Coach Details added");

                    // Insert into bus layout info table
                    const busLayoutInsertQuery = {
                        text: 'INSERT INTO bus_layout_info (bus_id, bus_coach_id, number_of_seats, row, col) VALUES ($1, $2, $3, $4, $5)',
                        values: [busId, busCoachId, numberOfSeats, row, col]
                    };
                    await busPool.query(busLayoutInsertQuery);
                    console.log("Bus Layout Info added");

                    // Get the bus layout id
                    const busLayoutIdQuery = {
                        text: 'SELECT bus_layout_id FROM bus_layout_info WHERE bus_id = $1 AND bus_coach_id = $2',
                        values: [busId, busCoachId]
                    };
                    const busLayoutIdResult = await busPool.query(busLayoutIdQuery);
                    const busLayoutId = busLayoutIdResult.rows[0].bus_layout_id;
                    console.log("Bus Layout Id", busLayoutId);

                    // Insert into bus seat details table
                    for (let i = 0; i < row; i++) {
                        let colCount = 0;
                        for (let j = 0; j < col; j++) {
                            const seatName = String.fromCharCode(65 + i) + (colCount + 1);
                            const isSeat = layout[i][j];
                            const seatQuery = {
                                text: 'INSERT INTO bus_seat_details (bus_layout_id, seat_name, is_seat, row_id, col_id) VALUES ($1, $2, $3, $4, $5)',
                                values: [busLayoutId, seatName, isSeat, i, j]
                            };
                            await busPool.query(seatQuery);
                        }
                    }
                    console.log("Bus Seat Details added");
                }
                console.log("Bus Info added");
                res.status(200).json({ message: 'Bus Info added' });
            } catch (error) {
                // Rollback transaction
                await busPool.query('ROLLBACK');
                console.log(error);
                res.status(500).json({ message: error.message });
            } finally {
                // End transaction
                await busPool.query('COMMIT');
            }
        }
    });
}

// Add coach info with coach name
const addCoachInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, coachName, adminRole} = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("addCoachInfo called from bus-service");
                console.log(req.body);
                // Check admin role
                if (adminRole !== 'ADMIN') {
                    console.log("Unauthorized access: admin role invalid");
                    return res.status(401).json({ message: 'Unauthorized access: admin role invalid' });
                }
                // Check if coach name already exists
                const checkQuery = {
                    text: 'SELECT * FROM coach_info WHERE coach_name = $1',
                    values: [coachName]
                };
                const checkResult = await busPool.query(checkQuery);
                if (checkResult.rows.length > 0) {
                    console.log("Coach name already exists");
                    return res.status(400).json({ message: 'Coach name already exists' });
                }
                const query = {
                    text: 'INSERT INTO coach_info (coach_name) VALUES ($1)',
                    values: [coachName]
                };
                await busPool.query(query);
                console.log("Coach added");
                res.status(200).json({ message: 'Bus Coach added' });
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Get Coach Info
const getCoachInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const token = req.body.token;
    // const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access");
            res.status(401).json({ message: 'Unauthorized access: invalid token' });
        } else {
            try {
                console.log("getCoachInfo called from bus-service");
                const query = {
                    text: 'SELECT * FROM coach_info'
                };
                const result = await busPool.query(query);
                const coachInfo = result.rows;
                console.log(coachInfo);
                res.status(200).json(coachInfo);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Get unique bus id for each bus from bus coach details table
const getUniqueBusIdList = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, busCompanyName, coachId, brandName} = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getUniqueBusId called from bus-service");
                console.log(req.body);
                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Get the brand id from brand name
                const brandIdQuery = {
                    text: 'SELECT brand_name_id FROM brand_name_info WHERE brand_name = $1',
                    values: [brandName]
                };
                const brandNameIdResult = await busPool.query(brandIdQuery);
                if (brandNameIdResult.rows.length === 0) {
                    return res.status(200).json([]);
                }
                const brandNameId = brandNameIdResult.rows[0].brand_name_id;
                console.log("Brand id", brandNameId);

                // Get the unique bus id from bus coach details table
                const query = {
                    text: 'SELECT unique_bus_id FROM bus_coach_details WHERE bus_id = $1 AND coach_id = $2 AND brand_name_id = $3',
                    values: [busId, coachId, brandNameId]
                };
                const result = await busPool.query(query);
                const uniqueBusId = result.rows;
                console.log(uniqueBusId);
                res.status(200).json(uniqueBusId);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Get brand information with coach
const getBrandInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, busCompanyName} = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getBrandInfo called from bus-service");

                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Get the coach info and brand info from bus coach info table
                const query = {
                    text: `SELECT coach_info.coach_name, coach_info.coach_id, brand_name_info.brand_name  
                    FROM bus_coach_info 
                    INNER JOIN coach_info ON bus_coach_info.coach_id = coach_info.coach_id 
                    INNER JOIN brand_name_info ON bus_coach_info.brand_name_Id = brand_name_info.brand_name_id
                    WHERE bus_coach_info.bus_id = $1`,
                    values: [busId]
                };
                const result = await busPool.query(query);
                const brandInfo = result.rows;
                let brandInfoList = [];

                console.log(brandInfo)

                let coachInfo = {};
                brandInfo.forEach((brand) => {
                    if (coachInfo[brand.coach_id]) {
                        coachInfo[brand.coach_id].brandList.push(brand.brand_name);
                    } else {
                        coachInfo[brand.coach_id] = {
                            coachName: brand.coach_name,
                            brandList: [brand.brand_name]
                        };
                    }
                });
                console.log(coachInfo);
                for (let coachId in coachInfo) {
                    let brandInfo = coachInfo[coachId];
                    brandInfo.coachId = coachId;
                    brandInfoList.push(brandInfo);
                }
                res.status(200).json(brandInfoList);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Get bus details, schedule details by bus id
const getBusLayout = async (req, res) => {
    // get the token
    console.log(req.body)
    const {token, busCompanyName, coachId, brandName} = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)

    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getBusLayout called from bus-service");
                console.log(req.body);

                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Get the brand id from brand name
                const brandIdQuery = {
                    text: 'SELECT brand_name_id FROM brand_name_info WHERE brand_name = $1',
                    values: [brandName]
                };
                const brandNameIdResult = await busPool.query(brandIdQuery);
                if (brandNameIdResult.rows.length === 0) {
                    return res.status(200).json([]);
                }
                const brandNameId = brandNameIdResult.rows[0].brand_name_id;
                console.log("Brand id", brandNameId);

                // Get the bus coach id from bus coach info table
                const busCoachIdQuery = {
                    text: 'SELECT bus_coach_id FROM bus_coach_info WHERE bus_id = $1 AND coach_id = $2 AND brand_name_id = $3',
                    values: [busId, coachId, brandNameId]
                };
                const busCoachIdResult = await busPool.query(busCoachIdQuery);
                const busCoachId = busCoachIdResult.rows[0].bus_coach_id;
                console.log("Bus Coach Id", busCoachId);

                let queryText = `SELECT bus_coach_info.bus_id, bus_coach_info.bus_coach_id, bus_coach_info.number_of_bus, brand_name_info.brand_name,  
                                bus_layout_info.bus_layout_id, bus_layout_info.number_of_seats, 
                                bus_layout_info.row, bus_layout_info.col 
                                FROM bus_coach_info 
                                INNER JOIN bus_layout_info ON bus_coach_info.bus_coach_id = bus_layout_info.bus_coach_id 
                                INNER JOIN brand_name_info ON bus_coach_info.brand_name_Id = brand_name_info.brand_name_id 
                                WHERE bus_coach_info.bus_id = $1 AND bus_coach_info.bus_coach_id = $2`;
                let queryValues = [busId, busCoachId];
                const query = {
                    text: queryText,
                    values: queryValues
                };
                const result = await busPool.query(query);
                let busInfo = result.rows;

                if (busInfo.length === 0) {
                    return res.status(200).json([]);
                }

                for (let i = 0; i < busInfo.length; i++) {
                    let layoutInfo = busInfo[i];
                    // Get seat details for each layout
                    let seatQuery = {
                        text: `SELECT bus_seat_details.seat_name, bus_seat_details.is_seat, bus_seat_details.row_id, bus_seat_details.col_id
                        FROM bus_seat_details WHERE bus_seat_details.bus_layout_id = $1`,
                        values: [layoutInfo.bus_layout_id]
                    };

                    const seatResult = await busPool.query(seatQuery);
                    let seatDetails = seatResult.rows;
                    let layout = [];
                    for (let i = 0; i < layoutInfo.row; i++) {
                        layout.push(new Array(layoutInfo.col).fill(0));
                    }
                    for (let i = 0; i < seatDetails.length; i++) {
                        let seat = seatDetails[i];
                        if (seat.is_seat) {
                            layout[seat.row_id][seat.col_id] = 1;
                        }
                    }
                    layoutInfo.layout = layout;
                }
                console.log(busInfo[0]);                
                res.status(200).json(busInfo[0]);
            } catch(error) {
                console.log(error);
                res.status(500).json({ message: error.message })
            }
        }
    });
}

// Get bus information
const getBusInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, busCompanyName} = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            return res.status(401).json({ message: 'Unauthorized access: token invalid' });
        }
        try {
            console.log("getBusInfo called from bus-service");
            console.log(req.body);

            // Get the bus id from bus company name
            const busIdQuery = {
                text: 'SELECT bus_id, coach_info FROM bus_services WHERE bus_company_name = $1',
                values: [busCompanyName]
            };
            const busIdResult = await busPool.query(busIdQuery);
            const busId = busIdResult.rows[0].bus_id;
            // a set to avoid duplicates
            const coachInfoSet = new Set(busIdResult.rows[0].coach_info); 
            console.log("Bus id", busId);

            let result = [];

            for (let coachId of coachInfoSet) {
                const brandInfoQuery = {
                    text: `SELECT bus_coach_info.bus_coach_id, bus_coach_info.number_of_bus, bus_coach_info.facilities, brand_name_info.brand_name,
                            coach_info.coach_name, coach_info.coach_id, bus_layout_info.bus_layout_id, bus_layout_info.number_of_seats,
                            bus_layout_info.row, bus_layout_info.col 
                            FROM bus_coach_info
                            INNER JOIN brand_name_info ON bus_coach_info.brand_name_id = brand_name_info.brand_name_id
                            INNER JOIN coach_info ON bus_coach_info.coach_id = coach_info.coach_id 
                            INNER JOIN bus_layout_info ON bus_coach_info.bus_coach_id = bus_layout_info.bus_coach_id
                            WHERE bus_coach_info.bus_id = $1 AND bus_coach_info.coach_id = $2`,
                    values: [busId, coachId]
                };
                const brandInfoResult = await busPool.query(brandInfoQuery);
                const brandInfo = brandInfoResult.rows;

                for (let brand of brandInfo) {
                    let layoutId = brand.bus_layout_id;
                    const seatQuery = {
                        text: `SELECT bus_seat_details.seat_name, bus_seat_details.is_seat, bus_seat_details.row_id, bus_seat_details.col_id
                        FROM bus_seat_details WHERE bus_seat_details.bus_layout_id = $1`,
                        values: [layoutId]
                    };
                    const seatResult = await busPool.query(seatQuery);
                    let seatDetails = seatResult.rows;
                    let layout = Array(brand.row).fill().map(() => Array(brand.col).fill(0));
                    for (let seat of seatDetails) {
                        if (seat.is_seat) {
                            layout[seat.row_id][seat.col_id] = 1;
                        }
                    }
                    brand.layout = layout;
                    result.push(brand);
                }
            }

            console.log(result);
            res.status(200).json(result);
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: error.message });
        }
    });
}

// Get all unique bus
const getAllUniqueBus = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, busCompanyName, coachId, brandName} = req.body;
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)

    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getAllUniqueBus called from bus-service");
                console.log(req.body);

                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Get the brand id from brand name
                const brandIdQuery = {
                    text: 'SELECT brand_name_id FROM brand_name_info WHERE brand_name = $1',
                    values: [brandName]
                };
                const brandNameIdResult = await busPool.query(brandIdQuery);
                const brandNameId = brandNameIdResult.rows[0].brand_name_id;
                console.log("Brand id", brandNameId);
                
                // Get the unique bus id from bus coach details table
                const busCoachDetailsQuery = {
                    text: 'SELECT unique_bus_id, status FROM bus_coach_details WHERE bus_id = $1 AND coach_id = $2 AND brand_name_id = $3',
                    values: [busId, coachId, brandNameId]
                };
                const busCoachDetailsResult = await busPool.query(busCoachDetailsQuery);
                const uniqueBusId = busCoachDetailsResult.rows;
                console.log(uniqueBusId);
                res.status(200).json(uniqueBusId);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Get districts
const getLocation = async (req, res) => {
    // get the token
    // console.log(req)
    const {token} = req.body;
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)

    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getDistricts called from bus-service");
                const query = {
                    text: 'SELECT * FROM location_info'
                };
                const result = await busPool.query(query);
                const districts = result.rows;
                console.log(districts);
                res.status(200).json(districts);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Get available bus
const getAvailableBus = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, busCompanyName, coachId, brandName, date} = req.body;
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)

    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getAvailableBus called from bus-service");
                console.log(req.body);
                
                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Get the brand id from brand name
                const brandIdQuery = {
                    text: 'SELECT brand_name_id FROM brand_name_info WHERE brand_name = $1',
                    values: [brandName]
                };
                const brandNameIdResult = await busPool.query(brandIdQuery);
                const brandNameId = brandNameIdResult.rows[0].brand_name_id;
                console.log("Brand id", brandNameId);

                // Get the bus coach id from bus coach info table
                const busCoachIdQuery = {
                    text: 'SELECT bus_coach_id FROM bus_coach_info WHERE bus_id = $1 AND coach_id = $2 AND brand_name_id = $3',
                    values: [busId, coachId, brandNameId]
                };
                const busCoachIdResult = await busPool.query(busCoachIdQuery);
                if (busCoachIdResult.rows.length === 0) {
                    return res.status(200).json([]);
                }
                const busCoachId = busCoachIdResult.rows[0].bus_coach_id;
                console.log("Bus Coach Id", busCoachId);

                // Get the bus layout id from bus layout info table
                const busLayoutIdQuery = {
                    text: 'SELECT bus_layout_id, number_of_seats, row, col FROM bus_layout_info WHERE bus_id = $1 AND bus_coach_id = $2',
                    values: [busId, busCoachId]
                };
                const busLayoutIdResult = await busPool.query(busLayoutIdQuery);
                const busLayoutId = busLayoutIdResult.rows[0].bus_layout_id;
                const numberOfSeats = busLayoutIdResult.rows[0].number_of_seats;
                const row = busLayoutIdResult.rows[0].row;
                const col = busLayoutIdResult.rows[0].col;
                console.log("Bus Layout Id", busLayoutId);

                // Get the bus seat details from bus seat details table
                const busSeatDetailsQuery = {
                    text: 'SELECT seat_name, is_seat, row_id, col_id FROM bus_seat_details WHERE bus_layout_id = $1',
                    values: [busLayoutId]
                };
                const busSeatDetailsResult = await busPool.query(busSeatDetailsQuery);
                const busSeatDetails = busSeatDetailsResult.rows;
                
                let layout = [];
                for (let i = 0; i < row; i++) {
                    layout.push(new Array(col).fill(0));
                }
                for (let i = 0; i < busSeatDetails.length; i++) {
                    let seat = busSeatDetails[i];
                    if (seat.is_seat) {
                        layout[seat.row_id][seat.col_id] = 1;
                    }
                }
                console.log(layout);

                const dateParts = date.split('-');
                const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // yyyy-mm-dd

                // Get the unique bus id list from schedule info table whose schedule status is 1
                const scheduleInfoQuery = {
                    text: 'SELECT unique_bus_id FROM bus_schedule_info WHERE bus_id = $1 AND schedule_status = $2 AND schedule_date = $3',
                    values: [busId, 1, isoDate]
                };
                const scheduleInfoResult = await busPool.query(scheduleInfoQuery);
                const uniqueBusIdList = scheduleInfoResult.rows;
                
                // Get the unique bus id array from unique bus id list
                let uniqueBusIdArray = [];
                for (let i = 0; i < uniqueBusIdList.length; i++) {
                    uniqueBusIdArray.push(uniqueBusIdList[i].unique_bus_id);
                }

                // Get the unique bus id list from bus coach details table whose unique bus id is not in unique bus id array
                const busCoachDetailsQuery = {
                    text: 'SELECT unique_bus_id FROM bus_coach_details WHERE bus_id = $1 AND coach_id = $2 AND brand_name_id = $3 AND unique_bus_id NOT IN ($4)',
                    values: [busId, coachId, brandNameId, uniqueBusIdArray]
                };
                const busCoachDetailsResult = await busPool.query(busCoachDetailsQuery);
                const uniqueBusId = busCoachDetailsResult.rows;
                console.log(uniqueBusId);

                let result = {}
                result.uniqueBusId = uniqueBusId;
                result.layout = layout;
                result.numberOfSeats = numberOfSeats;
                console.log(result);
                res.status(200).json(result);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Add bus schedule info with bus id, source, destination, departure time, arrival time, fare and date
const addBusScheduleInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, busCompanyName, src, dest, destPoints, date, schedule} = req.body;

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)

    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                // Begin transaction
                await busPool.query('BEGIN');
                console.log("addBusScheduleInfo called from bus-service");
                console.log(req.body);

                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                for (let i = 0; i < schedule.length; i++) {
                    let scheduleInfo = schedule[i];
                    const { time, uniqueBusId, fare } = scheduleInfo;

                    const dateParts = date.split('-');
                    const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // yyyy-mm-dd

                    // Add bus schedule info to bus schedule info table
                    const busScheduleInfoQuery = {
                        text: 'INSERT INTO bus_schedule_info (bus_id, unique_bus_id, starting_point, ending_point, destination_points, departure_time, bus_fare, schedule_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                        values: [busId, uniqueBusId, src, dest, destPoints, time, fare, isoDate]
                    };
                    await busPool.query(busScheduleInfoQuery);
                    console.log("Bus schedule info added");

                    // Get the bus schedule id from bus schedule info table
                    const busScheduleIdQuery = {
                        text: 'SELECT bus_schedule_id FROM bus_schedule_info WHERE bus_id = $1 AND unique_bus_id = $2 AND starting_point = $3 AND ending_point = $4 AND departure_time = $5 AND schedule_date = $6 ORDER BY bus_schedule_id DESC LIMIT 1',
                        values: [busId, uniqueBusId, src, dest, time, isoDate]
                    };
                    const busScheduleIdResult = await busPool.query(busScheduleIdQuery);
                    const busScheduleId = busScheduleIdResult.rows[0].bus_schedule_id;
                    console.log("Bus schedule id", busScheduleId);

                    // Get the bus coach id from bus coach details table
                    const busCoachIdQuery = {
                        text: `SELECT bus_coach_info.bus_coach_id, bus_coach_details.unique_bus_id  
                            FROM bus_coach_info 
                            INNER JOIN bus_coach_details ON bus_coach_info.bus_id = bus_coach_details.bus_id 
                            AND bus_coach_info.coach_id = bus_coach_details.coach_id
                            AND bus_coach_info.brand_name_id = bus_coach_details.brand_name_id
                            WHERE bus_coach_details.unique_bus_id = $1`,
                        values: [uniqueBusId]
                    };
                    const busCoachIdResult = await busPool.query(busCoachIdQuery);
                    const busCoachId = busCoachIdResult.rows[0].bus_coach_id;
                    console.log("Bus coach id", busCoachId);

                    // Get the bus layout id from bus layout info table
                    const busLayoutIdQuery = {
                        text: 'SELECT bus_layout_id FROM bus_layout_info WHERE bus_coach_id = $1',
                        values: [busCoachId]
                    };
                    const busLayoutIdResult = await busPool.query(busLayoutIdQuery);
                    const busLayoutId = busLayoutIdResult.rows[0].bus_layout_id;
                    console.log("Bus layout id", busLayoutId);

                    // Get the bus seat details from bus seat details table
                    const busSeatDetailsQuery = {
                        text: 'SELECT bus_seat_id, is_seat FROM bus_seat_details WHERE bus_layout_id = $1',
                        values: [busLayoutId]
                    };
                    const busSeatDetailsResult = await busPool.query(busSeatDetailsQuery);
                    const busSeatDetails = busSeatDetailsResult.rows;

                    // Add bus seat details to bus schedule seat details table
                    for (let j = 0; j < busSeatDetails.length; j++) {
                        let seat = busSeatDetails[j];
                        if (seat.is_seat) {
                            const busScheduleSeatDetailsQuery = {
                                text: 'INSERT INTO bus_schedule_seat_info (bus_schedule_id, bus_layout_id, bus_seat_id) VALUES ($1, $2, $3)',
                                values: [busScheduleId, busLayoutId, seat.bus_seat_id]
                            };
                            await busPool.query(busScheduleSeatDetailsQuery);
                        }
                    }
                    console.log("Bus schedule seat details added");
                }
                console.log("Bus schedule details added");
                res.status(200).json({ message: 'Bus schedule details added' });
            } catch (error) {
                console.log(error);
                // Rollback transaction
                await busPool.query('ROLLBACK');
                res.status(500).json({ message: error.message });
            } finally {
                // End transaction
                await busPool.query('COMMIT');
            }
        }
    });

}

// Get unique bus schedule info
const getUniqueBusScheduleInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, busCompanyName, uniqueBusId} = req.body;
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getUniqueBusScheduleInfo called from bus-service");
                console.log(req.body);

                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Get the bus schedule info from bus schedule info table
                const busScheduleInfoQuery = {
                    text: `SELECT bus_schedule_id, starting_point, ending_point, destination_points, departure_time, bus_fare, schedule_date FROM bus_schedule_info WHERE bus_id = $1 AND unique_bus_id = $2`,
                    values: [busId, uniqueBusId]
                };
                const busScheduleInfoResult = await busPool.query(busScheduleInfoQuery);
                const busScheduleInfo = busScheduleInfoResult.rows;
                console.log(busScheduleInfo);

                for (let i = 0; i < busScheduleInfo.length; i++) {
                    let scheduleInfo = busScheduleInfo[i];
                    const busScheduleId = scheduleInfo.bus_schedule_id;

                    // Get the booked count from bus schedule seat info table
                    const bookedCountQuery = {
                        text: 'SELECT COUNT(*) FROM bus_schedule_seat_info WHERE bus_schedule_id = $1 AND booked_status = 1',
                        values: [busScheduleId]
                    };
                    const bookedCountResult = await busPool.query(bookedCountQuery);
                    const bookedCount = bookedCountResult.rows[0].count;
                    
                    busScheduleInfo[i].bookedCount = bookedCount;

                    // Get the total count from bus schedule seat info table
                    const totalCountQuery = {
                        text: 'SELECT COUNT(*) FROM bus_schedule_seat_info WHERE bus_schedule_id = $1',
                        values: [busScheduleId]
                    };
                    const totalCountResult = await busPool.query(totalCountQuery);
                    const totalCount = totalCountResult.rows[0].count;

                    busScheduleInfo[i].totalCount = totalCount;
                }
                console.log(busScheduleInfo);
                res.status(200).json(busScheduleInfo);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Remove bus schedule info
const removeBusScheduleInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const token = req.body.token;
    // const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access");
            res.status(401).json({ message: 'Unauthorized access: Invalid Token' });
        } else {
            try {
                console.log("removeBusScheduleInfo called from bus-service");
                const busScheduleId = req.body.busScheduleId;
                // Check if the bus schedule id exists
                const checkQuery = {
                    text: 'SELECT * FROM bus_schedule_info WHERE bus_schedule_id = $1',
                    values: [busScheduleId]
                };
                const checkResult = await busPool.query(checkQuery);
                if (checkResult.rows.length === 0) {
                    return res.status(400).json({ message: 'Bus schedule does not exist' });
                }
                
                // Remove bus schedule info
                const query = {
                    text: 'UPDATE bus_schedule_info SET schedule_status = 0 WHERE bus_schedule_id = $1',
                    values: [busScheduleId]
                };
                await busPool.query(query);
                console.log("Bus schedule info removed");
                res.status(200).json({ message: 'Bus schedule info removed' });
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

const getCountOfAllUniqueBuses = async (req, res) => {
    // get the token from the request body
    const { token, busCompanyName } = req.body;
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)

    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getCountOfAllUniqueBuses called from bus-service");

                // get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Query the bus_coach_details table to count distinct unique_bus_id
                const countUniqueBusesQuery = {
                    text: 'SELECT COUNT(DISTINCT unique_bus_id) FROM bus_coach_details where bus_id = $1',
                    values: [busId]
                };
                const countResult = await busPool.query(countUniqueBusesQuery);
                const totalCount = countResult.rows[0].count;
                console.log("Total unique buses:", totalCount);
                
                res.status(200).json({ totalUniqueBuses: totalCount });
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}


// Add bus info
const updateBusStatus = async (req, res) => {
    // get the token
    // console.log(req)
    const { token, busCompanyName, unique_bus_id, status } = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                // Begin transaction
                await busPool.query('BEGIN');
                
                // get bus_id from bus_services
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                console.log(status, " ", busId, " ", unique_bus_id);

                // update status in bus_coach_details based on bus_id and unique_bus_id
                const updateStatusQuery = {
                    text: 'UPDATE bus_coach_details SET status = $1 WHERE bus_id = $2 AND unique_bus_id = $3',
                    values: [status, busId, unique_bus_id]
                };
                await busPool.query(updateStatusQuery);

                console.log("Bus Status Updated");
                res.status(200).json({ message: 'Bus Status Updated' });
            } catch (error) {
                // Rollback transaction
                await busPool.query('ROLLBACK');
                console.log(error);
                res.status(500).json({ message: error.message });
            } finally {
                // End transaction
                await busPool.query('COMMIT');
            }
        }
    });
}



// Get bus facilities
const getBusFacilities = async (req, res) => {
    // get the token
    console.log(req.body)
    const {token, busCompanyName, coachId, brandName} = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)

    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getBusLayout called from bus-service");
                console.log(req.body);

                // Get the bus id from bus company name
                const busIdQuery = {
                    text: 'SELECT bus_id FROM bus_services WHERE bus_company_name = $1',
                    values: [busCompanyName]
                };
                const busIdResult = await busPool.query(busIdQuery);
                const busId = busIdResult.rows[0].bus_id;
                console.log("Bus id", busId);

                // Get the brand id from brand name
                const brandIdQuery = {
                    text: 'SELECT brand_name_id FROM brand_name_info WHERE brand_name = $1',
                    values: [brandName]
                };
                const brandNameIdResult = await busPool.query(brandIdQuery);
                if (brandNameIdResult.rows.length === 0) {
                    return res.status(200).json([]);
                }
                const brandNameId = brandNameIdResult.rows[0].brand_name_id;
                console.log("Brand id", brandNameId);

                // Get the bus coach id from bus coach info table
                const busCoachIdQuery = {
                    text: 'SELECT bus_coach_id FROM bus_coach_info WHERE bus_id = $1 AND coach_id = $2 AND brand_name_id = $3',
                    values: [busId, coachId, brandNameId]
                };
                const busCoachIdResult = await busPool.query(busCoachIdQuery);
                const busCoachId = busCoachIdResult.rows[0].bus_coach_id;
                console.log("Bus Coach Id", busCoachId);

                // get facilities from bus_coach_info table based on bus_id and bus_coach_id 
                const busFacilitiesQuery = {
                    text: 'SELECT facilities FROM bus_coach_info WHERE bus_id = $1 AND bus_coach_id = $2',
                    values: [busId, busCoachId]
                };
                const busFacilitiesResult = await busPool.query(busFacilitiesQuery);
                const busFacilities = busFacilitiesResult.rows[0];
                console.log(busFacilities);
                res.status(200).json(busFacilities);
            } catch(error) {
                console.log(error);
                res.status(500).json({ message: error.message })
            }
        }
    });
}


module.exports = {
    addBusInfo,
    addCoachInfo,
    getCoachInfo,
    getUniqueBusIdList,
    getBrandInfo,
    getBusLayout,
    getBusInfo,
    getAllUniqueBus,
    getLocation,
    getAvailableBus,
    addBusScheduleInfo,
    getUniqueBusScheduleInfo,
    getCountOfAllUniqueBuses,
    updateBusStatus,
    getBusFacilities,
}