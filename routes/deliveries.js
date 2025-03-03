// routes/deliveries.js
const express = require('express');
const router = express.Router();
const db = require('../db');
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





//  สร้าง  Delivery  ของ users(คนส่ง)
// Create a new Delivery with image upload
router.post('/', upload.single('product_image'), async (req, res) => {
  const { sender_id, receiver_phone_number, delivery_status, pickup_address, pickup_gps, dropoff_address, dropoff_gps, rider_id } = req.body;
  const product_image = req.file ? req.file.path : null;

  try {
      // If there's an image, attempt to copy it to the desired directory
      if (product_image) {
          const destination = path.join('D:', 'mysql', 'htdocs', 'uploads', path.basename(product_image));
          await fs.copyFile(product_image, destination); // Copy file using async/await
      }

      const query = `
          INSERT INTO Deliveries (sender_id, receiver_phone_number, delivery_status, product_image, pickup_address, pickup_gps, dropoff_address, dropoff_gps, rider_id)
          VALUES (?, ?, ?, ?, ?, POINT(?, ?), ?, POINT(?, ?), ?)
      `;

      db.query(
          query,
          [sender_id, receiver_phone_number, delivery_status, product_image, pickup_address, pickup_gps.x, pickup_gps.y, dropoff_address, dropoff_gps.x, dropoff_gps.y, rider_id],
          (err, result) => {
              if (err) return res.status(500).json({ message: 'Error creating delivery', error: err });
              res.status(201).json({ message: 'Delivery created', delivery_id: result.insertId });
          }
      );
  } catch (err) {
      console.error('Error copying file:', err);
      return res.status(500).json({ message: 'Error copying image file', error: err });
  }
});



// API เช็คว่า  deliveries ไหนบ้างที่ว่าง  delivery_status = 'รอไรเดอร์มารับสินค้า' และ  ไม่มี rider_id == null 
router.get('/pending-deliveries', (req, res) => {
  const query = `
    SELECT * FROM Deliveries 
    WHERE delivery_status = 'รอไรเดอร์มารับสินค้า' 
    AND rider_id IS NULL
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching pending deliveries', error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No pending deliveries found' });
    }

    res.status(200).json(results);
  });
});







// API  Rider เลือกสินค้าที่จะไปส่ง   rider_id   
// โดยใส่  delivery_id    rider_id      (delivery_status   == สถานะของสินค้า)
router.put('/update-delivery', (req, res) => {
  const { delivery_id, rider_id, delivery_status } = req.body;

  // Validate required fields
  if (!delivery_id || !rider_id || !delivery_status) {
    return res.status(400).json({ message: 'delivery_id, rider_id, and delivery_status are required' });
  }

  const query = `
    UPDATE Deliveries
    SET rider_id = ?, delivery_status = ?
    WHERE delivery_id = ?
  `;

  db.query(query, [rider_id, delivery_status, delivery_id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error updating delivery', error: err });
    }

    // Check if any row was actually updated
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Delivery not found or no changes made' });
    }

    res.status(200).json({ message: 'Delivery updated successfully' });
  });
});



//API  ค้นหา    Deliveries   ที่  receiver_phone_number ที่ตรงกัน ทั้งหมด  
///   ค้นหา   Deliveries ของผู้รับที่จะได้ ด้วย  receiver_phone_number
router.get('/receiver_phone/:receiver_phone_number', (req, res) => {
  const { receiver_phone_number } = req.params; // Use req.params to get the URL parameter

  // Check if receiver_phone_number is provided
  if (!receiver_phone_number) {
    return res.status(400).json({ message: 'receiver_phone_number is required' });
  }

  const query = `
    SELECT delivery_id, sender_id, receiver_phone_number, delivery_status, product_image, pickup_address, 
           ST_AsText(pickup_gps) AS pickup_gps, dropoff_address, ST_AsText(dropoff_gps) AS dropoff_gps, rider_id, created_at, updated_at
    FROM Deliveries
    WHERE receiver_phone_number = ?
  `;

  db.query(query, [receiver_phone_number], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching deliveries', error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No deliveries found for the provided receiver_phone_number' });
    }

    // Parse the POINT type to return as x and y for GPS fields
    const parsedResults = results.map((delivery) => {
      // Use a try-catch to handle potential errors in parsing the POINT fields
      let pickup_gps = { x: null, y: null };
      let dropoff_gps = { x: null, y: null };

      try {
        if (delivery.pickup_gps) {
          const parsedPickup = delivery.pickup_gps.match(/\(([^)]+)\)/);
          if (parsedPickup) {
            pickup_gps = parsedPickup[1].split(' ').map(Number);
          }
        }
        if (delivery.dropoff_gps) {
          const parsedDropoff = delivery.dropoff_gps.match(/\(([^)]+)\)/);
          if (parsedDropoff) {
            dropoff_gps = parsedDropoff[1].split(' ').map(Number);
          }
        }
      } catch (error) {
        console.error("Error parsing GPS data:", error);
      }

      return {
        ...delivery,
        pickup_gps: {
          x: pickup_gps[0],
          y: pickup_gps[1],
        },
        dropoff_gps: {
          x: dropoff_gps[0],
          y: dropoff_gps[1],
        }
      };
    });

    // Send the parsed results as the response
    res.status(200).json(parsedResults);
  });
});






// API ค้นหา สถานะการส่งทั้งหมด   ของ   (sender_id  = user_id) ของคนนั้นๆ
router.get('/:sender_id', (req, res) => {
  const { sender_id } = req.params;

  // Check if sender_id is a valid integer
  if (isNaN(sender_id)) {
    return res.status(400).json({ message: 'Invalid sender_id. It must be a number.' });
  }

  const query = `SELECT * FROM Deliveries WHERE sender_id = ?`;

  db.query(query, [sender_id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching deliveries', error: err });
    }

    // Return the filtered deliveries
    res.status(200).json(results);
  });
});






// Get all Deliveries
router.get('/', (req, res) => {
  const query = `SELECT * FROM Deliveries`;
  db.query(query, (err, results) => {
      if (err) return res.status(500).json({ message: 'Error fetching deliveries', error: err });
      res.status(200).json(results);
  });
});

module.exports = router;
