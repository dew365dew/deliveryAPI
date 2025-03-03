const express = require('express');
const router = express.Router();
const db = require('../db'); // Import DB connection
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

// API สร้าง ให้  Riders มารับสินค้า  ไรเดอร์รับสินค้าแล้วและกำลังเดินทาง
router.post('/', upload.single('image_url'), async (req, res) => {
    const { delivery_id, status } = req.body;
    const image_url = req.file ? req.file.path : null;

    // Check if required fields are provided
    if (!delivery_id || !status || !image_url) {
        return res.status(400).json({ message: 'delivery_id, status, and image are required' });
    }

    try {
        // Prepare SQL query to insert data into Delivery_Images
        const query = `
            INSERT INTO delivery_images (delivery_id, image_url, status)
            VALUES (?, ?, ?)
        `;

        // Copy the uploaded file to the desired destination
        const destination = path.join('D:', 'mysql', 'htdocs', 'uploads', path.basename(image_url));
        await fs.copyFile(image_url, destination); // Copy the file using async/await

        db.query(query, [delivery_id, image_url, status], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Error inserting into Delivery_Images', error: err });
            }
            res.status(201).json({ message: 'Image added successfully', image_id: result.insertId });
        });
    } catch (error) {
        console.error('Error while uploading image:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
});

// แก้ไข  status ของ  delivery_images  เช่น  , ไรเดอร์นำส่งสินค้าแล้ว   
// และถ่ายรูปได้ด้วย  ไรเดอร์รับสินค้าแล้วและกำลังเดินทาง  รึแก้ ไรเดอร์นำส่งสินค้าแล้ว
router.put('/update-status/:image_id', upload.single('image_url'), async (req, res) => {
    const { image_id } = req.params; // Get image_id from URL
    const { status } = req.body; // Get status from request body
    const image_url = req.file ? req.file.path : null; // Get the new image URL if a file is uploaded

    // Validate that the status is provided
    if (!status) {
        return res.status(400).json({ message: 'Status is required' });
    }

    try {
        // Prepare SQL update query
        let query = `
            UPDATE delivery_images
            SET status = ?
        `;

        const values = [status]; // Start values array with status

        // Check if an image URL is provided, and append it to the query
        if (image_url) {
            query += `, image_url = ?`;
            values.push(image_url);

            // Copy the uploaded file to the desired destination
            const destination = path.join('D:', 'mysql', 'htdocs', 'uploads', path.basename(image_url));
            await fs.copyFile(image_url, destination); // Copy the file using async/await
        }

        query += ` WHERE image_id = ?`;
        values.push(image_id);

        // Execute the update query
        db.query(query, values, (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Error updating status', error: err });
            }

            // Check if any rows were updated
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Image not found' });
            }

            res.status(200).json({ message: 'Status updated successfully' });
        });
    } catch (error) {
        console.error('Error while updating status:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
});


//  http://127.0.0.1:3000/api/delivery_lmages
// GET route to fetch all entries from Delivery_Images
router.get('/', (req, res) => {
    const query = 'SELECT * FROM delivery_images';

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error fetching images', error: err });
        
        res.status(200).json(results);
    });
});




//  
// API ค้นหา  ผู้รับ  สินค้า ตัวเอง  ค้นหา image_id  ที่มี   ข้อมูล receiver_phone_number  ตรงกับ 
router.get('/receiver_phone/:receiver_phone_number', (req, res) => {
    const { receiver_phone_number } = req.params; // รับ receiver_phone_number จาก URL
  
    // ตรวจสอบว่ามีการส่ง receiver_phone_number หรือไม่
    if (!receiver_phone_number) {
      return res.status(400).json({ message: 'receiver_phone_number is required' });
    }
  
    // Query เพื่อค้นหาข้อมูล delivery_id ใน Deliveries ที่ตรงกับ receiver_phone_number
    // และ JOIN กับตาราง Delivery_Images เพื่อดึงข้อมูล image_id
    const query = `
      SELECT di.image_id, di.image_url, di.status, di.uploaded_at
      FROM delivery_images di
      JOIN deliveries d ON di.delivery_id = d.delivery_id
      WHERE d.receiver_phone_number = ?
    `;
  
    db.query(query, [receiver_phone_number], (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching images', error: err });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ message: 'No images found for the provided receiver_phone_number' });
      }
  
      // ส่งข้อมูล image_id และรายละเอียดของรูปภาพ
      res.status(200).json(results);
    });
  });


module.exports = router;
