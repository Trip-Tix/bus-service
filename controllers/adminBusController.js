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
    const { token, busCompanyName, coachId, brandName, alreadyExist, layout, row, col, numBus, uniqueBusId, numSeat } = req.body;
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
                        text: 'INSERT INTO bus_coach_info (bus_id, coach_id, brand_name_id, number_of_bus) VALUES ($1, $2, $3, $4)',
                        values: [busId, coachId, brandNameId, numBus]
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
                const busId = busIdResult.rows[0].busId;
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

                let coachInfo = {};
                brandInfo.forEach((brand) => {
                    if (coachInfo[brand.coach_id]) {
                        coachInfo['brandList'].push(brand.brand_name);
                    } else {
                        coachInfo[brand.coach_id] = {
                            coachName: brand.coach_name,
                            brandList: [brand.brand_name]
                        };
                    }
                });
                for (let coachName in coachInfo) {
                    brandInfoList.push({
                        coachName: coachName,
                        brandName: coachInfo[coachName]
                    });
                }
                console.log(brandInfoList);
                console.log(brandInfo);
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

                let queryText = `SELECT bus_coach_info.bus_id, bus_coach_info.bus_coach_id, bus_coach_info.coach_name, bus_coach_info.number_of_bus, brand_name_info.brand_name,  
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
                    let layout = busInfo[i];
                    // Get seat details for each layout
                    let seatQuery = {
                        text: `SELECT bus_seat_details.seat_name, bus_seat_details.is_seat, bus_seat_details.row_id, bus_seat_details.col_id
                        FROM bus_seat_details WHERE bus_seat_details.bus_layout_id = $1`,
                        values: [layout.busLayoutId]
                    };

                    const seatResult = await busPool.query(seatQuery);
                    let seatDetails = seatResult.rows;
                    let matrix = [];
                    for (let i = 0; i < layout.row; i++) {
                        matrix.push(new Array(layout.col).fill(0));
                    }
                    for (let i = 0; i < seatDetails.length; i++) {
                        let seat = seatDetails[i];
                        if (seat.isSeat) {
                            matrix[seat.rowId][seat.colId] = 1;
                        }
                    }
                    layout.matrix = matrix;
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


// Get Bus Info
const getBusNames = async (req, res) => {
    // get the token
    // console.log(req)
    const {token} = req.body;
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
                console.log("getBusNames called from bus-service");
                const {adminUsername} = req.body;
                // Check if admin has bus admin role or admin role
                const checkQuery = {
                    text: 'SELECT admin_info.admin_id, admin_role_info.admin_role_name FROM admin_info INNER JOIN admin_role_info ON admin_info.admin_role_id = admin_role_info.admin_role_id WHERE admin_info.username = $1',
                    values: [adminUsername]
                };
                const checkResult = await accountPool.query(checkQuery);
                if (checkResult.rows.length === 0) {
                    console.log("Admin does not exist");
                    return res.status(400).json({ message: 'Admin does not exist' });
                }
                const adminRole = checkResult.rows[0].admin_role_name;
                const adminId = checkResult.rows[0].admin_id;
                console.log(adminRole);
                if (adminRole !== 'ADMIN' && adminRole !== 'BUS ADMIN') {
                    console.log("Unauthorized access: admin role invalid");
                    return res.status(401).json({ message: 'Unauthorized access: admin role invalid' });
                }

                // Get bus names from bus_services table
                let queryText = 'SELECT bus_name FROM bus_services';
                let queryValues = [];
                if (adminRole === 'BUS ADMIN') {
                    queryText += ' WHERE $1 = ANY(admin_id)';
                    queryValues.push(adminId);
                }
                const query = {
                    text: queryText,
                    values: queryValues
                };
                const result = await busPool.query(query);
                let busInfo = result.rows;
                console.log(busInfo);
                res.status(200).json(busInfo);
            } catch (error) {
                console.log(error.message);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

//Get all bus
const getAllBus = async (req, res) => {
    // get the token
    // console.log(req)
    const {token} = req.body;
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
                console.log("getAllBus called from bus-service");
                const {adminUsername} = req.body;
                // Check if admin has bus admin role or admin role
                const checkQuery = {
                    text: 'SELECT admin_info.admin_id, admin_role_info.admin_role_name FROM admin_info INNER JOIN admin_role_info ON admin_info.admin_role_id = admin_role_info.admin_role_id WHERE admin_info.username = $1',
                    values: [adminUsername]
                };
                const checkResult = await accountPool.query(checkQuery);
                if (checkResult.rows.length === 0) {
                    console.log("Admin does not exist");
                    return res.status(400).json({ message: 'Admin does not exist' });
                }
                const adminRole = checkResult.rows[0].admin_role_name;
                const adminId = checkResult.rows[0].admin_id;
                console.log(adminRole);
                if (adminRole !== 'ADMIN' && adminRole !== 'BUS ADMIN') {
                    console.log("Unauthorized access: admin role invalid");
                    return res.status(401).json({ message: 'Unauthorized access: admin role invalid' });
                }

                // Get bus_id, bus_name, coach_id, coach_name, total_number_of_buses, number_of_buses, bus_coach_id from bus_services table and bus_coach_info table
                let queryText = `SELECT bus_services.bus_id, bus_services.bus_name,
                                bus_coach_info.number_of_buses, bus_coach_info.coach_name, bus_coach_info.bus_coach_id
                                FROM bus_services INNER JOIN bus_coach_info ON bus_services.bus_id = bus_coach_info.bus_id`;
                let queryValues = [];
                if (adminRole === 'BUS ADMIN') {
                    queryText += ' WHERE $1 = ANY(bus_services.admin_id)';
                    queryValues.push(adminId);
                }
                const query = {
                    text: queryText,
                    values: queryValues
                };

                const result = await busPool.query(query);
                let busInfo = result.rows;
                console.log(busInfo);
                res.status(200).json(busInfo);
            } catch (error) {
                console.log(error.message);
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// // Get bus details, schedule details by bus id
// const getBusLayout = async (req, res) => {
//     // get the token
//     console.log(req.body)
//     const {token, busId, busCoachId, adminUsername} = req.body;
//     if (!token) {
//         return res.status(401).json({ message: 'No token provided' });
//     }

//     // verify the token
//     console.log("token", token)
//     console.log("secretKey", secretKey)

//     jwt.verify(token, secretKey, async (err, decoded) => {
//         if (err) {
//             console.log("Unauthorized access");
//             res.status(401).json({ message: 'Unauthorized access: token invalid' });
//         } else {
//             try {
//                 console.log("getBusLayout called from bus-service");
//                 // Check if admin has bus admin role or admin role
//                 const checkQuery = {
//                     text: 'SELECT admin_info.admin_id, admin_role_info.admin_role_name FROM admin_info INNER JOIN admin_role_info ON admin_info.admin_role_id = admin_role_info.admin_role_id WHERE admin_info.username = $1',
//                     values: [adminUsername]
//                 };
//                 const checkResult = await accountPool.query(checkQuery);
//                 if (checkResult.rows.length === 0) {
//                     console.log("Admin does not exist");
//                     return res.status(400).json({ message: 'Admin does not exist' });
//                 }
//                 const adminRole = checkResult.rows[0].admin_role_name;
//                 const adminId = checkResult.rows[0].admin_id;
//                 if (adminRole !== 'ADMIN' && adminRole !== 'BUS ADMIN') {
//                     console.log("Unauthorized access");
//                     return res.status(401).json({ message: 'Unauthorized access: admin role invalid' });
//                 }

//                 let queryText = `SELECT bus_coach_info.bus_id, bus_coach_info.bus_coach_id, bus_coach_info.coach_name, 
//                                 bus_layout_info.bus_layout_id, bus_layout_info.number_of_seats, 
//                                 bus_layout_info.matrix_rows, bus_layout_info.matrix_cols 
//                                 FROM bus_coach_info INNER JOIN bus_layout_info ON bus_coach_info.bus_coach_id = bus_layout_info.bus_coach_id 
//                                 WHERE bus_coach_info.bus_id = $1 AND bus_coach_info.bus_coach_id = $2`;
//                 let queryValues = [busId, busCoachId];
//                 if (adminRole === 'BUS ADMIN') {
//                     queryText += ' AND $3 = ANY(bus_services.admin_id)';
//                     queryValues.push(adminId);
//                 }

//                 // Get bus_id, bus_name, coach_id, coach_name, total_number_of_buses, number_of_buses from bus_services table and bus_coach_info table
//                 const query = {
//                     text: queryText,
//                     values: queryValues
//                 };
//                 const result = await busPool.query(query);
//                 let busInfo = result.rows;

//                 if (busInfo.length === 0) {
//                     return res.status(200).json([]);
//                 }

//                 for (let i = 0; i < busInfo.length; i++) {
//                     let layout = busInfo[i];
//                     // Get seat details for each layout
//                     let seatQuery = {
//                         text: `SELECT bus_seat_details.seat_name, bus_seat_details.is_seat, bus_seat_details.matrix_row_id, bus_seat_details.matrix_col_id
//                         FROM bus_seat_details WHERE bus_seat_details.bus_layout_id = $1`,
//                         values: [layout.bus_layout_id]
//                     };

//                     const seatResult = await busPool.query(seatQuery);
//                     let seatDetails = seatResult.rows;
//                     let matrix = [];
//                     for (let i = 0; i < layout.matrix_rows; i++) {
//                         matrix.push(new Array(layout.matrix_cols).fill(0));
//                     }
//                     for (let i = 0; i < seatDetails.length; i++) {
//                         let seat = seatDetails[i];
//                         if (seat.is_seat) {
//                             matrix[seat.matrix_row_id][seat.matrix_col_id] = 1;
//                         }
//                     }
//                     layout.matrix = matrix;
//                 }
//                 console.log(busInfo[0]);                
//                 res.status(200).json(busInfo[0]);
//             } catch(error) {
//                 console.log(error);
//                 res.status(500).json({ message: error.message })
//             }
//         }
//     });
// }

// Add bus schedule info with bus id, source, destination, departure time, arrival time, fare and date
const addBusScheduleInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const {token} = req.body;

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

                const {schedule, busId, adminUsername} = req.body;
                // Check if admin has bus admin role or admin role
                const checkQuery = {
                    text: 'SELECT admin_info.admin_id, admin_role_info.admin_role_name FROM admin_info INNER JOIN admin_role_info ON admin_info.admin_role_id = admin_role_info.admin_role_id WHERE admin_info.username = $1',
                    values: [adminUsername]
                };

                
                for (let i = 0; i < schedule.length; i++) {
                    const {date, timeWiseInfo} = schedule[i];
                    for (let j = 0; j < timeWiseInfo.length; j++) {
                        const {departureTime, arrivingTime, coachId, fare, source, destination} = timeWiseInfo[j];
                        // Check if bus schedule already exists
                        const checkQuery = {
                            text: 'SELECT * FROM bus_schedule_info WHERE bus_id = $1 AND source = $2 AND destination = $3 AND departure_time = $4 AND coach_id = $5 AND schedule_date = $6',
                            values: [busId, source, destination, departureTime, coachId, date]
                        };
                        const checkResult = await busPool.query(checkQuery);
                        if (checkResult.rows.length > 0) {
                            console.log("Bus schedule already exists");

                            // Rollback transaction
                            await busPool.query('ROLLBACK');
                            return res.status(400).json({ message: 'Bus schedule already exists' });
                        }
                        
                        // Check if bus layout exists
                        const checkQuery2 = {
                            text: 'SELECT * FROM bus_layout_info WHERE bus_id = $1 AND coach_id = $2',
                            values: [busId, coachId]
                        };
                        const checkResult2 = await busPool.query(checkQuery2);
                        if (checkResult2.rows.length === 0) {
                            console.log("Bus layout does not exist");
                            // Rollback transaction
                            await busPool.query('ROLLBACK');
                            return res.status(400).json({ message: 'Bus layout does not exist' });
                        }

                        // Get the bus layout id
                        const busLayoutId = checkResult2.rows[0].bus_layout_id;

                        // Add bus schedule info
                        const query = {
                            text: 'INSERT INTO bus_schedule_info (bus_id, source, destination, departure_time, arrival_time, bus_fare, coach_id, schedule_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                            values: [busId, source, destination, departureTime, arrivingTime, fare, coachId, date]
                        };
                        await busPool.query(query);
                        console.log("Bus schedule added");

                        // Get the bus schedule id
                        const getQuery = {
                            text: 'SELECT * FROM bus_schedule_info WHERE bus_id = $1 AND source = $2 AND destination = $3 AND departure_time = $4 AND coach_id = $5 AND schedule_date = $6',
                            values: [busId, source, destination, departureTime, coachId, date]
                        };
                        const getResult = await busPool.query(getQuery);
                        const busScheduleId = getResult.rows[0].bus_schedule_id;

                        // Insert into bus schedule seat info table with bus schedule id and bus layout id and the seat details selecting from seat details table with bus layout id
                        const insertQuery = {
                            text: 'INSERT INTO bus_schedule_seat_info (bus_schedule_id, bus_layout_id, bus_seat_id) SELECT $1, $2, bus_seat_id FROM bus_seat_details WHERE bus_layout_id = $3 and is_seat = 1',
                            values: [busScheduleId, busLayoutId, busLayoutId]
                        };
                        await busPool.query(insertQuery);
                        console.log("Bus schedule seat info added");
                    }
                }

                console.log("Bus schedule details added");
                res.status(200).json({ message: 'Bus schedule added' });
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

// Get schedule wise bus details: bus name, coach name, source, destination, departure time, bus fare from bus schedule info table, bus info table, coach info table
const getScheduleWiseBusDetails = async (req, res) => {
    // get the token
    // console.log(req)
    const {token} = req.body;
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
                console.log("getScheduleWiseBusDetails called from bus-service");
                const {adminUsername} = req.body;
                // Check if admin has bus admin role or admin role
                const checkQuery = {
                    text: 'SELECT admin_info.admin_id, admin_role_info.admin_role FROM admin_info INNER JOIN admin_role_info ON admin_info.admin_role_info = admin_role_info.admin_role_id WHERE admin_info.username = $1',
                    values: [adminUsername]
                };
                const checkResult = await accountPool.query(checkQuery);
                if (checkResult.rows.length === 0) {
                    console.log("Admin does not exist");
                    return res.status(400).json({ message: 'Admin does not exist' });
                }
                const adminRole = checkResult.rows[0].admin_role;
                const adminId = checkResult.rows[0].admin_id;
                if (adminRole !== 'ADMIN' && adminRole !== 'BUS ADMIN') {
                    console.log("Unauthorized access");
                    return res.status(401).json({ message: 'Unauthorized access: admin role invalid' });
                }

                let queryText = `SELECT bus_schedule_info.bus_schedule_id, bus_services.bus_name, 
                            coach_info.coach_name, bus_schedule_info.source, bus_schedule_info.destination, 
                            bus_schedule_info.departure_time, bus_schedule_info.arrival_time, 
                            bus_schedule_info.bus_fare, bus_schedule_info.schedule_date 
                            FROM bus_schedule_info 
                            INNER JOIN bus_services ON bus_schedule_info.bus_id = bus_services.bus_id 
                            INNER JOIN coach_info ON bus_schedule_info.coach_id = coach_info.coach_id 
                            WHERE bus_schedule_info.schedule_status = 1`;
                let queryValues = [];
                if (adminRole === 'BUS ADMIN') {
                    queryText += ' AND bus_services.admin_id = $1';
                    queryValues.push(adminId);
                }
                queryText += ' ORDER BY bus_schedule_info.schedule_date DESC, bus_schedule_info.departure_time ASC';
                const query = {
                    text: queryText,
                    values: queryValues
                };
                const result = await busPool.query(query);
                console.log("Schedule wise bus details fetched");
                res.status(200).json(result.rows);
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


module.exports = {
    addBusInfo,
    addCoachInfo,
    getCoachInfo,
    getUniqueBusIdList,
    getBrandInfo,
    getBusLayout,
}