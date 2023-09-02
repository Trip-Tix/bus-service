const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const busPool = require('../config/busDB.js');
const accountPool = require('../config/accountDB.js');

dotenv.config();

const secretKey = process.env.SECRETKEY;

// Get all bus from source, destination and date
const getScheduleWiseBusDetails = async (req, res) => {
    console.log('getScheduleWiseBusDetails called from bus-service');
    console.log('req.body: ', req.body);
    const { source, destination, journeyDate, returnDate } = req.body;

    // Parse journeyDate and returnDate
    const journeyDateParts = journeyDate.split('-');
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
            values: [source, destination, isoJourneyDate]
        }
    
        const getBusDetailsResult = await busPool.query(getBusDetailsQuery);
        const busDetails = getBusDetailsResult.rows;
        console.log('busDetails: ', busDetails);
    
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
            const departureTimeParts = departureTime.split(':');
            let hour = parseInt(departureTimeParts[0]);
            let minute = departureTimeParts[1];
            let ampm = 'AM';
            if (hour > 12) {
                hour -= 12;
                ampm = 'PM';
            }
            if (hour === 12) {
                ampm = 'PM';
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
                values: [busId]
            }
            const getBusCompanyNameResult = await busPool.query(getBusCompanyNameQuery);
            const busCompanyName = getBusCompanyNameResult.rows[0].bus_company_name;
            busDetails[i].bus_company_name = busCompanyName;
    
            const getCoachInfoQuery = {
                text: `SELECT bus_coach_details.coach_id, bus_coach_details.brand_name_id, 
                coach_info.coach_name, bus_coach_info.bus_coach_id, brand_name_info.brand_name  
                FROM bus_coach_details 
                INNER JOIN coach_info ON bus_coach_details.coach_id = coach_info.coach_id 
                INNER JOIN brand_name_info ON bus_coach_details.brand_name_id = brand_name_info.brand_name_id 
                INNER JOIN bus_coach_info ON bus_coach_details.coach_id = bus_coach_info.coach_id 
                AND bus_coach_details.bus_id = bus_coach_info.bus_id 
                WHERE bus_coach_details.bus_id = $1 
                AND bus_coach_details.unique_bus_id = $2`,
                values: [busId, uniqueBusId]
            }
            const getCoachInfoResult = await busPool.query(getCoachInfoQuery);
            const coachInfo = getCoachInfoResult.rows[0];
            const coachId = coachInfo.coach_id;
            const brandNameId = coachInfo.brand_name_id;
            const coachName = coachInfo.coach_name;
            const busCoachId = coachInfo.bus_coach_id;
            const brandName = coachInfo.brand_name;
            
            busDetails[i].coach_id = coachId;
            busDetails[i].brand_name = brandName;
            busDetails[i].coach_name = coachName;
    
            const getAvailableSeatCountQuery = {
                text: `SELECT COUNT(*) 
                FROM bus_schedule_seat_info
                WHERE bus_schedule_id = $1
                AND booked_status = 0`,
                values: [busScheduleId]
            }
            const getAvailableSeatCountResult = await busPool.query(getAvailableSeatCountQuery);
            const availableSeatCount = getAvailableSeatCountResult.rows[0].count;
            busDetails[i].available_seat_count = availableSeatCount;

            // Get bus layout
            const getBusLayoutQuery = {
                text: `SELECT bus_layout_id, number_of_seats, row, col 
                FROM bus_layout_info
                WHERE bus_coach_id = $1 
                AND bus_id = $2`,
                values: [busCoachId, busId]
            }
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
                values: [busLayoutId]
            }
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
                console.log('seat: ', seat);
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
    
        console.log('busDetails: ', busDetails);
    
        return res.status(200).json(busDetails);
    } catch (error) {
        console.log('error: ', error);
        return res.status(500).json(error);
    }
}

// Get unique bus details
const getUniqueBusDetails = async (req, res) => {
    console.log('getUniqueBusDetails called from bus-service');

    // Get the token
    const {token, uniqueBusId, busId, busScheduleId} = req.body;
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'No token provided' });
    }

    // Verify the token
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Failed to authenticate token");
            return res.status(500).json({ message: 'Failed to authenticate token' });
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
            values: [uniqueBusId, busId]
        }
        const getBusCoachIdResult = await busPool.query(getBusCoachIdQuery);
        const busCoachId = getBusCoachIdResult.rows[0].bus_coach_id;
        console.log('busCoachId: ', busCoachId);

        // Get the bus layout id
        const getBusLayoutIdQuery = {
            text: `SELECT bus_layout_id, number_of_seats, row, col
            FROM bus_layout_info
            WHERE bus_coach_id = $1
            AND bus_id = $2`,
            values: [busCoachId, busId]
        }
        const getBusLayoutIdResult = await busPool.query(getBusLayoutIdQuery);
        const busLayoutId = getBusLayoutIdResult.rows[0].bus_layout_id;
        const numberOfSeats = getBusLayoutIdResult.rows[0].number_of_seats;
        const row = getBusLayoutIdResult.rows[0].row;
        const col = getBusLayoutIdResult.rows[0].col;
        let availableSeatCount = numberOfSeats;
        console.log('busLayoutId: ', busLayoutId);

        // Get the seat details
        const getSeatDetailsQuery = {
            text: `SELECT bus_seat_id, seat_name, is_seat, row_id, col_id
            FROM bus_seat_details
            WHERE bus_layout_id = $1`,
            values: [busLayoutId]
        }
        const getSeatDetailsResult = await busPool.query(getSeatDetailsQuery);
        const seatDetails = getSeatDetailsResult.rows;

        // Get the schedule seat details
        const getScheduleSeatDetailsQuery = {
            text: `SELECT bus_schedule_seat_id, bus_seat_id, booked_status, passenger_id 
            FROM bus_schedule_seat_info
            WHERE bus_schedule_id = $1 
            AND bus_layout_id = $2`,
            values: [busScheduleId, busLayoutId]
        }
        const getScheduleSeatDetailsResult = await busPool.query(getScheduleSeatDetailsQuery);
        const scheduleSeatDetails = getScheduleSeatDetailsResult.rows;

        let layout = [];
        for (let i = 0; i < row; i++) {
            layout.push(new Array(col).fill(0));
        }

        let seatName = [];
        for (let i = 0; i < row; i++) {
            seatName.push(new Array(col).fill(""));
        }

        for (let i = 0; i < seatDetails.length; i++) {
            let seat = seatDetails[i];
            console.log('seat: ', seat);
            if (seat.is_seat) {
                layout[seat.row_id][seat.col_id] = 1;
                seatName[seat.row_id][seat.col_id] = seat.seat_name;
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
                        if (seat.passenger_gender === "M") {
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
                        if (seat.passenger_gender === "M") {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 2;
                        } else {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 3;
                        }
                        break;
                    }
                }
            }
        }

        console.log('layout: ', layout);
        console.log('seatName: ', seatName);

        return res.status(200).json({layout, seatName, numberOfSeats, availableSeatCount});
    });
}






// // Temporary book seat
// const tempBookSeat = async (req, res) => {
//     // get the token
//     const {token, busScheduleId, uniqueBusId} = req.body;
//     if (!token) {
//         console.log("No token provided");
//         return res.status(401).json({ message: 'No token provided' });
//     }

module.exports = {
    getScheduleWiseBusDetails,
    getUniqueBusDetails
}