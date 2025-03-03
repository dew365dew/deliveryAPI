const express = require('express');
const router = express.Router();
const db = require('../db'); // Reuse DB connection from a shared file
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;


// Set up multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Directory to store uploaded files
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Save file with a unique name
  }
});

const upload = multer({ storage: storage });



//  API  INSERT  สมัคร  rider  
// post  http://127.0.0.1:3000/api/riders
router.post('/', upload.single('rider_image'), async (req, res) => {
  const { phone_number, password, name, vehicle_registration, current_location, availability_status } = req.body;

  // Get the path to the uploaded file
  const rider_image = req.file ? req.file.path : null;

  try {
    // If there's an image, copy it to the desired directory
    if (rider_image) {
      const destination = path.join('D:', 'mysql', 'htdocs', 'uploads', path.basename(rider_image));
      await fs.copyFile(rider_image, destination); // Copy the file using async/await
    }

    // Insert the rider into the database
    const query = `
      INSERT INTO Riders (phone_number, password, name, rider_image, vehicle_registration, current_location, availability_status)
      VALUES (?, ?, ?, ?, ?, POINT(?, ?), ?)
    `;

    db.query(
      query,
      [phone_number, password, name, rider_image, vehicle_registration, current_location.x, current_location.y, availability_status],
      (err, result) => {
        if (err) {
          console.error('Database insertion error:', err);
          return res.status(500).json({ message: 'Error inserting rider data', error: err });
        }
        res.status(201).json({ message: 'Rider created', rider_id: result.insertId });
      }
    );
  } catch (err) {
    console.error('Error copying file:', err);
    return res.status(500).json({ message: 'Error copying image file', error: err });
  }
});




//   API Edit  ข้อมูล  ของ rider 
router.put('/:rider_id', upload.single('rider_image'), async (req, res) => {
  const { phone_number, password, name, vehicle_registration, current_location, availability_status } = req.body;
  const { rider_id } = req.params;

  // Get the path to the uploaded file
  const rider_image = req.file ? req.file.path : null;

  try {
    // If a new image is uploaded, copy it to the desired directory
    if (rider_image) {
      const destination = path.join('D:', 'mysql', 'htdocs', 'uploads', path.basename(rider_image));
      await fs.copyFile(rider_image, destination); // Copy the file using async/await
    }

    // Update query, setting fields conditionally
    let query = `
      UPDATE Riders
      SET phone_number = ?, password = ?, name = ?, vehicle_registration = ?, current_location = POINT(?, ?), availability_status = ?
    `;
    const params = [phone_number, password, name, vehicle_registration, current_location.x, current_location.y, availability_status];

    // If a new image is provided, include it in the update query
    if (rider_image) {
      query += `, rider_image = ?`;
      params.push(rider_image);
    }

    query += ` WHERE rider_id = ?`;
    params.push(rider_id);

    // Execute the update query
    db.query(query, params, (err, result) => {
      if (err) {
        console.error('Database update error:', err);
        return res.status(500).json({ message: 'Error updating rider', error: err });
      }

      // Check if the rider was found and updated
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Rider not found or no changes made' });
      }

      res.status(200).json({ message: 'Rider updated successfully' });
    });

  } catch (err) {
    console.error('Error copying file or updating rider:', err);
    return res.status(500).json({ message: 'Error during update process', error: err });
  }
});





//   API เข้าสู้ระบบ Rider login with phone_number and password
// post http://127.0.0.1:3000/api/riders/login
router.post('/login', (req, res) => {
  const { phone_number, password } = req.body;

  const query = `
    SELECT * FROM Riders WHERE phone_number = ? AND password = ?
  `;

  db.query(query, [phone_number, password], (err, results) => {
    if (err) return res.status(500).json({ message: 'Internal server error', error: err });

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid phone number or password' });
    }

    // Return rider data on successful login
    const rider = results[0];
    
    // Handle potential null values (e.g., rider_image, availability_status)
    res.status(200).json({
      message: 'Login successful',
      rider: {
        rider_id: rider.rider_id,
        name: rider.name || null,  // Ensure null safety
        phone_number: rider.phone_number,
        rider_image: rider.rider_image || null, // Handle null value
        vehicle_registration: rider.vehicle_registration || null, // Handle null value
        availability_status: rider.availability_status || null  // Handle null value
      }
    });
  });
});


// API ค้นหา   rider  จาก rider_id
// http://127.0.0.1:3000/api/riders/1
router.get('/:rider_id', (req, res) => {
  const { rider_id } = req.params;

  const query = `SELECT * FROM Riders WHERE rider_id = ?`;

  db.query(query, [rider_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Internal server error', error: err });

    if (results.length === 0) {
      return res.status(404).json({ message: 'Rider not found' });
    }

    const rider = results[0];

    // Check if current_location is null, to avoid errors when accessing x and y properties
    let current_location = null;
    if (rider.current_location) {
      current_location = {
        x: rider.current_location.x,
        y: rider.current_location.y
      };
    }

    res.status(200).json({
      message: 'Rider found',
      rider: {
        rider_id: rider.rider_id,
        phone_number: rider.phone_number,
        name: rider.name,
        rider_image: rider.rider_image,
        vehicle_registration: rider.vehicle_registration,
        current_location: current_location, // Set to null if current_location is null
        availability_status: rider.availability_status
      }
    });
  });
});

// API to get all riders
//  http://127.0.0.1:3000/api/riders
router.get('/', (req, res) => {
  const query = 'SELECT * FROM Riders';

  db.query(query, (err, results) => {
    if (err) return res.status(500).json(err);
    
    // Return all rider data
    res.status(200).json(results);
  });
});

module.exports = router;
