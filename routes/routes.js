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
router.post('/api/admin/getBusInfo', adminBusController.getBusInfo);

// Add bus layout info from admin
router.post('/api/admin/addBusLayoutInfo', bodyParser, adminBusController.addBusLayoutInfo);

// Add bus schedule info from admin
router.post('/api/admin/addBusScheduleInfo', bodyParser, adminBusController.addBusScheduleInfo);

// Get bus schedule info from admin
router.post('/api/admin/getScheduleWiseBusDetails', adminBusController.getScheduleWiseBusDetails);

module.exports = router;