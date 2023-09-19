const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const busPool = require("../config/busDB.js");
const accountPool = require("../config/accountDB.js");
const nodemailer = require('nodemailer');

dotenv.config();

const secretKey = process.env.SECRETKEY;

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'triptix.sfz@gmail.com',
        pass: 'geviigtztnzsfnbm', // Use an "App Password" if you have 2-Step Verification enabled
    },
});

// Get all bus from source, destination and date
const getScheduleWiseBusDetails = async (req, res) => {
    console.log("getScheduleWiseBusDetails called from bus-service");
    console.log("req.body: ", req.body);
    const { source, destination, journeyDate } = req.body;

    // Parse journeyDate and returnDate
    const journeyDateParts = journeyDate.split("-");
    // const returnDateParts = returnDate.split('-');
    const isoJourneyDate = `${journeyDateParts[2]}-${journeyDateParts[1]}-${journeyDateParts[0]}`; // yyyy-mm-dd
    // const isoReturnDate = `${returnDateParts[2]}-${returnDateParts[1]}-${returnDateParts[0]}`; // yyyy-mm-dd

    try {
        const getBusDetailsQuery = {
            text: `SELECT unique_bus_id, bus_id, bus_schedule_id, bus_fare, destination_points, departure_time    
            FROM bus_schedule_info 
            WHERE starting_point = $1 
            AND $2 = ANY(destination_points) 
            AND schedule_date = $3 
            AND schedule_status = 1`,
            values: [source, destination, isoJourneyDate],
        };

        const getBusDetailsResult = await busPool.query(getBusDetailsQuery);
        const busDetails = getBusDetailsResult.rows;
        console.log("busDetails: ", busDetails);

        if (busDetails.length === 0) {
            return res.status(200).json([]);
        }

        for (let i = 0; i < busDetails.length; i++) {
            const busId = busDetails[i].bus_id;
            const uniqueBusId = busDetails[i].unique_bus_id;
            const busScheduleId = busDetails[i].bus_schedule_id;
            const fare = busDetails[i].bus_fare;
            const destinationPoints = busDetails[i].destination_points;

            // Change the departure time format to hh:mm AM/PM
            const departureTime = busDetails[i].departure_time;
            const departureTimeParts = departureTime.split(":");
            let hour = parseInt(departureTimeParts[0]);
            let minute = departureTimeParts[1];
            let ampm = "AM";
            if (hour > 12) {
                hour -= 12;
                ampm = "PM";
            }
            if (hour === 12) {
                ampm = "PM";
            }
            if (hour === 0) {
                hour = 12;
            }
            const departureTimeFormatted = `${hour}:${minute} ${ampm}`;
            busDetails[i].departure_time = departureTimeFormatted;

            busDetails[i].arrival_time = "";

            for (let j = 0; j < destinationPoints.length; j++) {
                if (destinationPoints[j] === destination) {
                    busDetails[i].fare = fare[j];
                    break;
                }
            }

            const getBusCompanyNameQuery = {
                text: `SELECT bus_company_name FROM bus_services WHERE bus_id = $1`,
                values: [busId],
            };
            const getBusCompanyNameResult = await busPool.query(
                getBusCompanyNameQuery
            );
            const busCompanyName = getBusCompanyNameResult.rows[0].bus_company_name;
            busDetails[i].bus_company_name = busCompanyName;

            const getCoachInfoQuery = {
                text: `SELECT bus_coach_details.coach_id, bus_coach_details.brand_name_id, 
                coach_info.coach_name, bus_coach_info.bus_coach_id, brand_name_info.brand_name, bus_coach_info.facilities   
                FROM bus_coach_details 
                INNER JOIN coach_info ON bus_coach_details.coach_id = coach_info.coach_id 
                INNER JOIN brand_name_info ON bus_coach_details.brand_name_id = brand_name_info.brand_name_id 
                INNER JOIN bus_coach_info ON bus_coach_details.coach_id = bus_coach_info.coach_id 
                AND bus_coach_details.bus_id = bus_coach_info.bus_id 
                WHERE bus_coach_details.bus_id = $1 
                AND bus_coach_details.unique_bus_id = $2`,
                values: [busId, uniqueBusId],
            };
            const getCoachInfoResult = await busPool.query(getCoachInfoQuery);
            const coachInfo = getCoachInfoResult.rows[0];
            const coachId = coachInfo.coach_id;
            const brandNameId = coachInfo.brand_name_id;
            const coachName = coachInfo.coach_name;
            const busCoachId = coachInfo.bus_coach_id;
            const brandName = coachInfo.brand_name;
            const facilities = coachInfo.facilities;

            busDetails[i].coach_id = coachId;
            busDetails[i].brand_name = brandName;
            busDetails[i].coach_name = coachName;
            busDetails[i].facilities = facilities;

            const getAvailableSeatCountQuery = {
                text: `SELECT COUNT(*) 
                FROM bus_schedule_seat_info
                WHERE bus_schedule_id = $1
                AND booked_status = 0`,
                values: [busScheduleId],
            };
            const getAvailableSeatCountResult = await busPool.query(
                getAvailableSeatCountQuery
            );
            const availableSeatCount = getAvailableSeatCountResult.rows[0].count;
            busDetails[i].available_seat_count = availableSeatCount;

            // Get bus layout
            const getBusLayoutQuery = {
                text: `SELECT bus_layout_id, number_of_seats, row, col 
                FROM bus_layout_info
                WHERE bus_coach_id = $1 
                AND bus_id = $2`,
                values: [busCoachId, busId],
            };
            const getBusLayoutResult = await busPool.query(getBusLayoutQuery);
            const busLayout = getBusLayoutResult.rows[0];
            const busLayoutId = busLayout.bus_layout_id;
            const numberOfSeats = busLayout.number_of_seats;
            const row = busLayout.row;
            const col = busLayout.col;
            busDetails[i].bus_layout_id = busLayoutId;
            busDetails[i].number_of_seats = numberOfSeats;

            const getSeatDetailsQuery = {
                text: `SELECT bus_seat_id, seat_name, is_seat, row_id, col_id 
                FROM bus_seat_details
                WHERE bus_layout_id = $1`,
                values: [busLayoutId],
            };
            const getSeatDetailsResult = await busPool.query(getSeatDetailsQuery);
            const seatDetails = getSeatDetailsResult.rows;

            let layout = [];
            for (let j = 0; j < row; j++) {
                layout.push(new Array(col).fill(0));
            }

            let seatName = [];
            for (let j = 0; j < row; j++) {
                seatName.push(new Array(col).fill(""));
            }

            for (let j = 0; j < seatDetails.length; j++) {
                let seat = seatDetails[j];
                console.log("seat: ", seat);
                if (seat.is_seat) {
                    layout[seat.row_id][seat.col_id] = 1;
                    seatName[seat.row_id][seat.col_id] = seat.seat_name;
                }
            }

            busDetails[i].layout = layout;
            busDetails[i].seat_name = seatName;

            // Remove unnecessary fields
            delete busDetails[i].bus_fare;
            delete busDetails[i].destination_points;
        }

        console.log("busDetails: ", busDetails);

        return res.status(200).json(busDetails);
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json(error);
    }
};

// Get unique bus details
const getUniqueBusDetails = async (req, res) => {
    console.log("getUniqueBusDetails called from bus-service");

    // Get the token
    const { token, uniqueBusId, busId, busScheduleId } = req.body;
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: "No token provided" });
    }

    // Verify the token
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Failed to authenticate token");
            return res.status(500).json({ message: "Failed to authenticate token" });
        }

        // Get the bus coach id
        const getBusCoachIdQuery = {
            text: `SELECT bus_coach_info.bus_coach_id, bus_coach_details.coach_id, bus_coach_details.brand_name_id 
            FROM bus_coach_info
            INNER JOIN bus_coach_details ON bus_coach_info.coach_id = bus_coach_details.coach_id 
            AND bus_coach_info.bus_id = bus_coach_details.bus_id 
            AND bus_coach_info.brand_name_id = bus_coach_details.brand_name_id
            WHERE bus_coach_details.unique_bus_id = $1
            AND bus_coach_details.bus_id = $2`,
            values: [uniqueBusId, busId],
        };
        const getBusCoachIdResult = await busPool.query(getBusCoachIdQuery);
        const busCoachId = getBusCoachIdResult.rows[0].bus_coach_id;
        console.log("busCoachId: ", busCoachId);

        // Get the bus layout id
        const getBusLayoutIdQuery = {
            text: `SELECT bus_layout_id, number_of_seats, row, col
            FROM bus_layout_info
            WHERE bus_coach_id = $1
            AND bus_id = $2`,
            values: [busCoachId, busId],
        };
        const getBusLayoutIdResult = await busPool.query(getBusLayoutIdQuery);
        const busLayoutId = getBusLayoutIdResult.rows[0].bus_layout_id;
        const numberOfSeats = getBusLayoutIdResult.rows[0].number_of_seats;
        const row = getBusLayoutIdResult.rows[0].row;
        const col = getBusLayoutIdResult.rows[0].col;
        let availableSeatCount = numberOfSeats;
        console.log("busLayoutId: ", busLayoutId);

        // Get the seat details
        const getSeatDetailsQuery = {
            text: `SELECT bus_seat_id, seat_name, is_seat, row_id, col_id
            FROM bus_seat_details
            WHERE bus_layout_id = $1`,
            values: [busLayoutId],
        };
        const getSeatDetailsResult = await busPool.query(getSeatDetailsQuery);
        const seatDetails = getSeatDetailsResult.rows;

        // Get the schedule seat details
        const getScheduleSeatDetailsQuery = {
            text: `SELECT bus_schedule_seat_id, bus_seat_id, booked_status, passenger_id 
            FROM bus_schedule_seat_info
            WHERE bus_schedule_id = $1 
            AND bus_layout_id = $2`,
            values: [busScheduleId, busLayoutId],
        };
        const getScheduleSeatDetailsResult = await busPool.query(
            getScheduleSeatDetailsQuery
        );
        const scheduleSeatDetails = getScheduleSeatDetailsResult.rows;

        let layout = [];
        for (let i = 0; i < row; i++) {
            layout.push(new Array(col).fill(0));
        }

        let seatName = [];
        for (let i = 0; i < row; i++) {
            seatName.push(new Array(col).fill(""));
        }

        let busSeatId = [];
        for (let i = 0; i < row; i++) {
            busSeatId.push(new Array(col).fill(-1));
        }

        for (let i = 0; i < seatDetails.length; i++) {
            let seat = seatDetails[i];
            console.log("seat: ", seat);
            if (seat.is_seat) {
                layout[seat.row_id][seat.col_id] = 1;
                seatName[seat.row_id][seat.col_id] = seat.seat_name;
                busSeatId[seat.row_id][seat.col_id] = seat.bus_seat_id;
            }
        }

        for (let i = 0; i < scheduleSeatDetails.length; i++) {
            let seat = scheduleSeatDetails[i];
            if (seat.booked_status === 1) {
                // Temporary Booked
                availableSeatCount--;
                let seatId = seat.bus_seat_id;
                for (let j = 0; j < seatDetails.length; j++) {
                    if (seatId === seatDetails[j].bus_seat_id) {
                        if (seat.passenger_gender === "Male") {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 4;
                        } else {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 5;
                        }
                        break;
                    }
                }
            } else if (seat.booked_status === 2) {
                // Permanent Booked
                availableSeatCount--;
                let seatId = seat.bus_seat_id;
                for (let j = 0; j < seatDetails.length; j++) {
                    if (seatId === seatDetails[j].bus_seat_id) {
                        if (seat.passenger_gender === "Male") {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 2;
                        } else {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 3;
                        }
                        break;
                    }
                }
            }
        }

        console.log("layout: ", layout);
        console.log("seatName: ", seatName);

        return res
            .status(200)
            .json({ layout, seatName, busSeatId, numberOfSeats, availableSeatCount });
    });
};

// Temporary book seat
const tempBookSeat = async (req, res) => {
    // get the token
    console.log(req.body);
    const { token, ticketInfo, userId } = req.body;

    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: "No token provided" });
    }

    // Verify the token
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Failed to authenticate token");
            return res.status(500).json({ message: "Failed to authenticate token" });
        }

        try {
            console.log("Temporary book seat called from bus-service");
            // Begin transaction
            await busPool.query("BEGIN");
            await accountPool.query("BEGIN");

            // Get the current date and time
            const today = new Date();
            const todayYear = today.getFullYear();
            const todayMonth = today.getMonth() + 1;
            const todayDate = today.getDate();
            const todayHour = today.getHours();
            const todayMinute = today.getMinutes();
            const todaySecond = today.getSeconds();
            const bookingTimestamp = new Date(
                `${todayYear}-${todayMonth}-${todayDate} ${todayHour}:${todayMinute}:${todaySecond}`
            ).getTime();

            const currentDate = `${todayYear}-${todayMonth}-${todayDate} ${todayHour}:${todayMinute}:${todaySecond}`; // yyyy-mm-dd

            let responseData = [];
            let tempResponseData = [];

            let grandTotalFare = 0;
            let tempTotalFare = 0;

            let isValidTicketPresent = false;
            let isInvalidTicketPresent = false;

            for (let i = 0; i < ticketInfo.length; i++) {
                const ticket = ticketInfo[i];
                const { busScheduleId, passengerInfo, source, destination } = ticket;
                const ticketId = Math.random().toString().substring(2, 17);

                // Generate unique ticket ID of 15 characters length with numbers only

                // Get the bus ticket fare 
                const getBusTicketFareQuery = {
                    text: `SELECT bus_fare FROM bus_schedule_info WHERE bus_schedule_id = $1`,
                    values: [busScheduleId],
                };
                const getBusTicketFareResult = await busPool.query(
                    getBusTicketFareQuery
                );
                const busTicketFare = parseInt(getBusTicketFareResult.rows[0].bus_fare);

                let perValidTicketFare = 0;
                let perTempTicketFare = 0;
                let temporaryNumberOfTickets = 0;

                let passengerIdArray = [];

                let temporaryBusSeatIdArray = [];
                let temporaryPassengerIdArray = [];


                for (let i = 0; i < passengerInfo.length; i++) {
                    const passenger = passengerInfo[i];
                    const {
                        busSeatId,
                        passengerName,
                        passengerGender,
                        passengerMobile,
                        passengerDob,
                        passengerNid,
                        passengerBirthCertficate,
                        isTemp,
                    } = passenger;

                    // Age calculation
                    const passengerDobParts = passengerDob.split("-");
                    const passengerDobYear = parseInt(passengerDobParts[0]);
                    const passengerDobMonth = parseInt(passengerDobParts[1]);
                    const passengerDobDate = parseInt(passengerDobParts[2]);

                    const today = new Date();
                    const todayYear = today.getFullYear();
                    const todayMonth = today.getMonth() + 1;
                    const todayDate = today.getDate();

                    let age = todayYear - passengerDobYear;
                    if (todayMonth < passengerDobMonth) {
                        age--;
                    } else if (todayMonth === passengerDobMonth) {
                        if (todayDate < passengerDobDate) {
                            age--;
                        }
                    }
                    console.log("dob: ", passengerDob);
                    console.log("age: ", age);

                    // Check if passenger already exists
                    const checkPassengerQuery = {
                        text: `SELECT passenger_id FROM passenger_info 
                        WHERE passenger_nid = $1 
                        OR passenger_birth_certificate = $2`,
                        values: [passengerNid, passengerBirthCertficate],
                    };
                    const checkPassengerResult = await accountPool.query(
                        checkPassengerQuery
                    );
                    const passengerResultInfo = checkPassengerResult.rows;
                    let passengerId = -1;
                    if (passengerResultInfo.length === 0) {
                        // Add passenger
                        const addPassengerQuery = {
                            text: `INSERT INTO passenger_info(
                                passenger_name, passenger_nid, passenger_birth_certificate, 
                                passenger_passport, passenger_mobile, passenger_gender, passenger_age)
                                VALUES ($1, $2, $3, $4, $5, $6, $7);`,
                            values: [
                                passengerName,
                                passengerNid,
                                passengerBirthCertficate,
                                "",
                                passengerMobile,
                                passengerGender,
                                age,
                            ],
                        };
                        await accountPool.query(addPassengerQuery);
                        console.log("Passenger added successfully");

                        // Get the passenger id
                        const getPassengerIdQuery = {
                            text: `SELECT passenger_id FROM passenger_info
                            WHERE passenger_nid = $1
                            OR passenger_birth_certificate = $2`,
                            values: [passengerNid, passengerBirthCertficate],
                        };
                        const getPassengerIdResult = await accountPool.query(
                            getPassengerIdQuery
                        );
                        passengerId = parseInt(getPassengerIdResult.rows[0].passenger_id);
                    } else {
                        passengerId = parseInt(passengerResultInfo[0].passenger_id);
                    }

                    if (isTemp) {
                        isInvalidTicketPresent = true;
                        perTempTicketFare += busTicketFare;
                        temporaryBusSeatIdArray.push(busSeatId);
                        temporaryPassengerIdArray.push(passengerId);
                        temporaryNumberOfTickets++;
                    } else {
                        isValidTicketPresent = true;
                        // Temporary booking ticket
                        perValidTicketFare += busTicketFare;
                        passengerIdArray.push(passengerId);
                        const tempBookSeatQuery = {
                            text: `UPDATE bus_schedule_seat_info
                        SET booked_status = 1, passenger_id = $1, passenger_gender = $2, booking_time = $3, ticket_id = $4, user_id = $5   
                        WHERE bus_schedule_id = $6
                        AND bus_seat_id = $7`,
                            values: [
                                passengerId,
                                passengerGender,
                                bookingTimestamp,
                                ticketId,
                                userId,
                                busScheduleId,
                                busSeatId,
                            ],
                        };
                        await busPool.query(tempBookSeatQuery);
                        console.log("Seat temporarily booked successfully");
                    }
                }

                if (isValidTicketPresent) {
                    const numTickets = passengerIdArray.length;
                    const insertIntoTicketInfoQuery = {
                        text: `INSERT INTO ticket_info (ticket_id, user_id, bus_schedule_id, 
                            number_of_tickets, total_fare, passenger_info, date, source, destination) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        values: [ticketId, userId, busScheduleId, numTickets, perValidTicketFare, passengerIdArray, currentDate, source, destination]
                    }
                    await busPool.query(insertIntoTicketInfoQuery);
                    console.log("Temporary Ticket added successfully");
                    responseData.push({
                        ticketId,
                        passengerIdArray,
                        busScheduleId,
                        totalFare: perValidTicketFare,
                        numberOfTickets: numTickets,
                    });
                }

                if (isInvalidTicketPresent) {
                    // Insert to ticket queue
                    const queueTicketId = Math.random().toString().substring(2, 17);
                    const insertIntoTicketQueueQuery = {
                        text: `INSERT INTO ticket_queue 
                        (queue_ticket_id, user_id, total_fare, bus_schedule_id, number_of_tickets, passenger_info, bus_seat_id, date, source, destination)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        values: [
                            queueTicketId,
                            userId,
                            perTempTicketFare,
                            busScheduleId,
                            temporaryNumberOfTickets,
                            temporaryPassengerIdArray,
                            temporaryBusSeatIdArray,
                            currentDate,
                            source,
                            destination,
                        ],
                    };
                    await busPool.query(insertIntoTicketQueueQuery);
                    console.log("Ticket added to queue successfully");
                    tempResponseData.push({
                        ticketId: queueTicketId,
                        passengerIdArray: temporaryPassengerIdArray,
                        busScheduleId,
                        totalFare: perTempTicketFare,
                        numberOfTickets: temporaryNumberOfTickets,
                    });
                }

                grandTotalFare += perValidTicketFare;
                tempTotalFare += perTempTicketFare;
            }
            const responseObj = {
                ticketInfo: responseData,
                tempTicketInfo: tempResponseData,
                grandTotalFare,
                tempTotalFare,
                userId,
            };
            console.log("Temporary ticket booked successfully");
            res.status(200).json(responseObj);
        } catch (error) {
            // Rollback transaction
            await busPool.query("ROLLBACK");
            await accountPool.query("ROLLBACK");
            console.log("error here: ", error);
            res.status(500).json(error);
        } finally {
            // Commit transaction
            await busPool.query("COMMIT");
            await accountPool.query("COMMIT");
        }
    });
};

// Get districts
const getLocation = async (req, res) => {
    try {
        console.log("getDistricts called from bus-service");
        const query = {
            text: "SELECT * FROM location_info",
        };
        const result = await busPool.query(query);
        const districts = result.rows;
        console.log(districts);
        res.status(200).json(districts);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

// Check temporary booked seat
const cancel = async (req, res) => {
    console.log('cancel called from bus-service');
    console.log('req.body: ', req.body);

    const { ticketId } = req.body;

    try {

        // Get the busScheduleId from ticketId
        const getBusScheduleIdQuery = {
            text: `SELECT bus_schedule_id
                        FROM ticket_info
                        WHERE ticket_id = $1`,
            values: [ticketId]
        }
        const getBusScheduleIdResult = await busPool.query(getBusScheduleIdQuery);

        if (getBusScheduleIdResult.rows.length === 0) {
            // delete from ticket queue
            const bh = {
                text: `DELETE FROM ticket_queue
                        WHERE queue_ticket_id = $1`,
                values: [ticketId]
            }
            await busPool.query(bh);

            return res.status(200).json({ message: 'Ticket cancelled successfully' });
        }

        const busScheduleId = getBusScheduleIdResult.rows[0].bus_schedule_id;
        const bookedStatus = getBusScheduleIdResult.rows[0].booked_status;

        // Remove from ticket_queue
        const removeFromTicketeueQuery = {
            text: `DELETE FROM ticket_info
                        WHERE ticket_id = $1`,
            values: [ticketId]
        }
        await busPool.query(removeFromTicketeueQuery);

        // Update status to 0
        const updateStatusQuery = {
            text: `UPDATE bus_schedule_seat_info
                        SET booked_status = 0 
                        WHERE ticket_id = $1`,
            values: [ticketId]
        }
        await busPool.query(updateStatusQuery);

        if (bookedStatus === 1) {
            // Search in ticket_queue with bus_schedule_id
            const getExpiredBusSeatIdQuery = {
                text: `SELECT *
                        FROM ticket_queue
                        WHERE bus_schedule_id = $1 ORDER BY date ASC`,
                values: [busScheduleId]
            }
            const getExpiredBusSeatIdResult = await busPool.query(getExpiredBusSeatIdQuery);
            const queueInfo = getExpiredBusSeatIdResult.rows;

            if (queueInfo.length === 0) {
                return res.status(200).json({ message: 'No queue found' });
            }

            // Remove from ticket_queue
            const removeFromTicketQueueQuery = {
                text: `DELETE FROM ticket_queue
                        WHERE queue_ticket_id = $1`,
                values: [queueInfo[0].queue_ticket_id]
            }
            await busPool.query(removeFromTicketQueueQuery);


            const expiredTicket = queueInfo[0];
            const userId = expiredTicket.user_id;

            // Insert into ticket_info
            const insertTicketInfoQuery = {
                text: `INSERT INTO ticket_info (ticket_id, user_id, total_fare, bus_schedule_id, number_of_tickets, passenger_info, date, source, destination)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ticket_id`,
                values: [expiredTicket.queue_ticket_id, expiredTicket.user_id, expiredTicket.total_fare, expiredTicket.bus_schedule_id, expiredTicket.number_of_tickets, expiredTicket.passenger_info, expiredTicket.date, expiredTicket.source, expiredTicket.destination]
            }
            const insertTicketInfoResult = await busPool.query(insertTicketInfoQuery);

            const expiredSeatIdArray = expiredTicket.bus_seat_id;

            // Update status to 1
            for (let i = 0; i < expiredSeatIdArray.length; i++) {
                const updateStatusQuery = {
                    text: `UPDATE bus_schedule_seat_info
                            SET user_id = $1, booked_status = 1, ticket_id = $2
                            WHERE bus_schedule_id = $3
                            AND bus_seat_id = $4`,
                    values: [userId, insertTicketInfoResult.rows[0].ticket_id, busScheduleId, expiredSeatIdArray[i]]
                }
                await busPool.query(updateStatusQuery);
            }

            console.log('Ticket cancelled successfully');

            // Get user email
            const getUserEmailQuery = {
                text: `SELECT email
                        FROM user_info
                        WHERE user_id = $1`,
                values: [userId]
            }
            const getUserEmailResult = await accountPool.query(getUserEmailQuery);
            const userEmail = getUserEmailResult.rows[0].email;

            // Send ticket to user email
            const mailOptions = {
                from: 'triptix.sfz@gmail.com',
                to: userEmail,
                subject: `${ticketId} Ticket`,
                text: 'Your ticket is free! Go to dashboard to proceed to payment',
            };
            await transporter.sendMail(mailOptions);
            console.log('Ticket sent to user email');
        }


        return res.status(200).json({ message: 'Ticket cancelled successfully' });
    } catch (error) {
        console.log('error: ', error);
        return res.status(500).json(error);
    }
}


const getBusSeatFareStat = async (req, res) => {
    const { src, dest, date } = req.body;

    try {
        console.log("getBusSeatFareStat called from bus-service");
        console.log(req.body);

        const dateParts = date.split('-');
        const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // yyyy-mm-dd

        // // Get location_id for src and dest
        // const locationQuery = {
        //     text: 'SELECT location_id, location_name FROM location_info WHERE location_name IN ($1, $2)',
        //     values: [src, dest]
        // };
        // const locationResult = await busPool.query(locationQuery);
        // console.log('locationResult: ', locationResult.rows);
        
        // const srcId = locationResult.rows.find(row => row.location_name === src).location_id;
        // const destId = locationResult.rows.find(row => row.location_name === dest).location_id;

        // console.log('srcId: ', srcId);
        // console.log('destId: ', destId);

        console.log('isoDate: ', isoDate);
        // Get bus_schedule_id for the given date, src, and dest
        const scheduleQuery = {
            text: 'SELECT bus_schedule_id, destination_points FROM bus_schedule_info WHERE starting_point = $1 AND $2 = ANY(destination_points) AND schedule_date = $3',
            values: [src, dest, isoDate]
        };
        
        const scheduleResult = await busPool.query(scheduleQuery);
        console.log('scheduleResult: ', scheduleResult.rows);

        if (scheduleResult.rows.length === 0) {
            return res.status(200).json({
                totalSeats: 0,
                bookedSeats: 0,
                avgFare: 0
            });
        }

        
        let totalSeats = 0;
        let bookedSeats = 0;
        let avgFare = 0;

        for (let i = 0; i < scheduleResult.rows.length; i++) {
            const schedule = scheduleResult.rows[i];
            const busScheduleId = schedule.bus_schedule_id;
            const destinationPoints = schedule.destination_points;

            // Get total seats for the bus
            const seatsQuery = {
                text: 'SELECT COUNT(bus_seat_id) as booked_seats FROM bus_schedule_seat_info WHERE bus_schedule_id = $1',
                values: [busScheduleId]
            };
            const seatsResult = await busPool.query(seatsQuery);
            totalSeats += parseInt(seatsResult.rows[0].booked_seats, 10);

            // Get total booked seats for the bus
            const bookedSeatsQuery = {
                text: 'SELECT COUNT(bus_seat_id) as booked_seats FROM bus_schedule_seat_info WHERE bus_schedule_id = $1 AND booked_status = 2',
                values: [busScheduleId]
            };
            const bookedSeatsResult = await busPool.query(bookedSeatsQuery);
            bookedSeats += parseInt(bookedSeatsResult.rows[0].booked_seats, 10);

            // Get average fare for the bus
            const fareQuery = {
                text: 'SELECT bus_fare FROM bus_schedule_info WHERE bus_schedule_id = $1',
                values: [busScheduleId]
            };

            const fareResult = await busPool.query(fareQuery);
            const fare = fareResult.rows[0].bus_fare;

            let totalFare = 0;
            let count = 0;

            for (let i = 0; i < destinationPoints.length; i++) {
                if (destinationPoints[i] === dest) {
                    totalFare += fare[i];
                    count++;
                }
            }

            avgFare +=  count > 0 ? totalFare / count : 0;
            
        }

        avgFare = avgFare / scheduleResult.rows.length;        
        
        res.status(200).json({
            totalSeats: totalSeats,
            bookedSeats: bookedSeats,
            avgFare: avgFare
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getScheduleWiseBusDetails,
    getUniqueBusDetails,
    tempBookSeat,
    getLocation,
    cancel,
    getBusSeatFareStat,
};
