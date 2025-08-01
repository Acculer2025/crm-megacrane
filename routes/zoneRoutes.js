// routes/zoneRoutes.js
const express = require('express');
const {
  getAllZones,
  createZone,
  updateZone,
  deleteZone
} = require('../controllers/zoneController');
const router = express.Router();

router.route('/')
  .get(getAllZones)
  .post(createZone);

router.route('/:id')
  .put(updateZone)
  .delete(deleteZone);

module.exports = router;