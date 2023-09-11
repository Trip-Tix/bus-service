const express = require('express');
const bodyParser = require('body-parser').json();
const adminBusController = require('../controllers/adminBusController');
const userBusController = require('../controllers/userBusController');

const router = express.Router();

// Add coach from admin
router.post('/api/admin/addCoachInfo', bodyParser, adminBusController.addCoachInfo);

// Get coach info from admin
router.post('/api/admin/getCoachInfo', bodyParser, adminBusController.getCoachInfo);

// Get unique bus id list from admin
router.post('/api/admin/getUniqueBusIdList', bodyParser, adminBusController.getUniqueBusIdList);

// Get single bus layout details
router.post('/api/admin/getBusLayout', bodyParser, adminBusController.getBusLayout);

// Get brand list from admin
router.post('/api/admin/getBrandInfo', bodyParser, adminBusController.getBrandInfo);

// Add bus from admin
router.post('/api/admin/addBusInfo', bodyParser, adminBusController.addBusInfo);

// Get bus info from admin
router.post('/api/admin/getBusInfo', bodyParser, adminBusController.getBusInfo);

// Get all unique bus id list from admin
router.post('/api/admin/getAllUniqueBus', bodyParser, adminBusController.getAllUniqueBus);

// Get count of all unique bus
router.post('/api/admin/getAllUniqueBusCount', bodyParser, adminBusController.getCountOfAllUniqueBuses);

// Get location list from admin
router.post('/api/admin/getLocation', bodyParser, adminBusController.getLocation);

// Get available bus list from admin
router.post('/api/admin/getAvailableBus', bodyParser, adminBusController.getAvailableBus);

// Add bus schedule info from admin
router.post('/api/admin/addBusScheduleInfo', bodyParser, adminBusController.addBusScheduleInfo);

// Get bus schedule info from admin
router.post('/api/admin/getUniqueBusScheduleInfo', bodyParser, adminBusController.getUniqueBusScheduleInfo);

// // Get bus info from admin
// router.post('/api/admin/getBusNames', bodyParser, adminBusController.getBusNames);

// // Get all bus
// router.post('/api/admin/getAllBus', bodyParser, adminBusController.getAllBus);

// // Get bus schedule info from admin
// router.post('/api/admin/getScheduleWiseBusDetails', bodyParser, adminBusController.getScheduleWiseBusDetails);

// // Remove bus schedule info from admin
// router.post('/api/admin/removeBusScheduleInfo', bodyParser, adminBusController.removeBusScheduleInfo);

// Get schedule wise bus details from user
router.post('/api/getScheduleWiseBusDetails', bodyParser, userBusController.getScheduleWiseBusDetails);

// Get unique bus details from user
router.post('/api/getUniqueBusDetails', bodyParser, userBusController.getUniqueBusDetails);

// Get unique bus count
router.post('/api/admin/getUniqueBusCount', bodyParser, adminBusController.getCountOfAllUniqueBuses);

// Temporary book ticket
router.post('/api/temporaryBookTicket', bodyParser, userBusController.tempBookSeat);

router.post('/api/getLocations', bodyParser, userBusController.getLocation);


// Update Bus Status
router.post('/api/admin/updateBusStatus', bodyParser, adminBusController.updateBusStatus);

// get facilities
router.post('/api/admin/getBusFacilities', bodyParser, adminBusController.getBusFacilities);

router.post('/api/admin/getAllBusCountUser', bodyParser, adminBusController.getUserCountOfAllUniqueBuses);

module.exports = router;