// routes/locationTracking.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Reuse DB connection from a shared file
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Track Rider Location
router.post('/', (req, res) => {
  const { delivery_id, rider_id, rider_location } = req.body;
  const query = `
    INSERT INTO Location_tracking (delivery_id, rider_id, rider_location)
    VALUES (?, ?, POINT(?, ?))
  `;
  db.query(
    query,
    [delivery_id, rider_id, rider_location.x, rider_location.y],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({ message: 'Rider location tracked', track_id: result.insertId });
    }
  );
});


//  แสดง สถานะของ  rider เวลาไปส่ง ของ ค้นหาจาก  rider_id ใน  TABLE Deliveries
// https://warm-viper-neutral.ngrok.app/api/location_tracking/rider-location/1 
router.get('/rider-location/:rider_id', (req, res) => {
  const { rider_id } = req.params;

  // Query to get rider location from Location_Tracking
  const locationQuery = `
    SELECT 
      ST_X(rider_location) as x, ST_Y(rider_location) as y 
    FROM 
      Location_Tracking 
    WHERE 
      rider_id = ?
    ORDER BY 
      timestamp DESC 
    LIMIT 1
  `;

  db.query(locationQuery, [rider_id], (err, locationResults) => {
    if (err) return res.status(500).json(err);

    if (locationResults.length === 0) return res.status(404).json({ message: 'No location found for this rider' });

    const result = {
      rider_location: {
        x: locationResults[0].x,
        y: locationResults[0].y
      }
    };

    res.status(200).json(result);
  });
});








// https://warm-viper-neutral.ngrok.app/api/location_tracking
router.get('/', (req, res) => {
  const query = 'SELECT * FROM location_tracking';

  db.query(query, (err, results) => {
    if (err) return res.status(500).json(err);
    
    // Return all user data
    res.status(200).json(results);
  });
});

module.exports = router;
