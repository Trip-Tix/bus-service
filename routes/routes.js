const express = require('express');
const bodyParser = require('body-parser').json();
const adminBusController = require('../controllers/adminBusController');

const router = express.Router();

// Add bus from admin
router.post('/api/admin/addBusInfo', bodyParser, adminBusController.addBusInfo);

// Add coach from admin
router.post('/api/admin/addCoachInfo', bodyParser, adminBusController.addCoachInfo);

// Get coach info from admin
router.post('/api/admin/getCoachInfo', bodyParser, adminBusController.getCoachInfo);

// Get bus info from admin
router.post('/api/admin/getBusNames', adminBusController.getBusNames);

// Get all bus
router.post('/api/admin/getAllBus', adminBusController.getAllBus);

// Add bus schedule info from admin
router.post('/api/admin/addBusScheduleInfo', bodyParser, adminBusController.addBusScheduleInfo);

// Get bus schedule info from admin
router.post('/api/admin/getScheduleWiseBusDetails', adminBusController.getScheduleWiseBusDetails);

// Remove bus schedule info from admin
router.post('/api/admin/removeBusScheduleInfo', bodyParser, adminBusController.removeBusScheduleInfo);

// Get single bus layout details
router.post('/api/admin/getBusLayout', bodyParser, adminBusController.getBusLayout);

module.exports = router;