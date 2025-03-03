// routes/users.js
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




// INSERT  Add new user
//  post http://127.0.0.1:3000/api/users
router.post('/', upload.single('user_image'), async (req, res) => {
  const { phone_number, password, name, address, gps_location = { x: 0, y: 0 }, user_type } = req.body;

  // Get the path to the uploaded file
  const user_image = req.file ? req.file.path : null;

  try {
    // If there's an image, attempt to copy it to the desired directory
    if (user_image) {
      const destination = path.join('D:', 'mysql', 'htdocs', 'uploads', path.basename(user_image));
      await fs.copyFile(user_image, destination); // Copy file using async/await
    }

    // Now proceed to insert the user into the database
    const query = `
      INSERT INTO Users (phone_number, password, name, user_image, address, gps_location, user_type)
      VALUES (?, ?, ?, ?, ?, POINT(?, ?), ?)
    `;

    db.query(
      query,
      [phone_number, password, name, user_image, address, gps_location.x, gps_location.y, user_type],
      (err, result) => {
        if (err) {
          console.error('Database insertion error:', err);
          return res.status(500).json({ message: 'Error inserting user data', error: err });
        }
        res.status(201).json({ message: 'User created', user_id: result.insertId });
      }
    );
  } catch (err) {
    console.error('Error copying file:', err);
    return res.status(500).json({ message: 'Error copying image file', error: err });
  }
});




// API Edit  ข้อมูล user ค้นหาจาก  user_id
router.put('/:user_id', upload.single('user_image'), async (req, res) => {
  const { phone_number, password, name, address, gps_location, user_type } = req.body;
  const { user_id } = req.params;

  // Get the path to the uploaded file
  const user_image = req.file ? req.file.path : null;

  try {
    // If a new image is uploaded, copy the file to the desired directory
    if (user_image) {
      const destination = path.join('D:', 'mysql', 'htdocs', 'uploads', path.basename(user_image));
      await fs.copyFile(user_image, destination); // Ensure the file is copied before proceeding
    }

    // Update query, setting fields conditionally
    let query = `
      UPDATE Users
      SET phone_number = ?, password = ?, name = ?, address = ?, gps_location = POINT(?, ?), user_type = ?
    `;
    const params = [phone_number, password, name, address, gps_location.x, gps_location.y, user_type];

    // If a new image is uploaded, include it in the update
    if (user_image) {
      query += `, user_image = ?`;
      params.push(user_image);
    }

    query += ` WHERE user_id = ?`;
    params.push(user_id);

    // Execute the update query
    db.query(query, params, (err, result) => {
      if (err) {
        console.error('Database update error:', err);
        return res.status(500).json({ message: 'Error updating user', error: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found or no changes made' });
      }

      res.status(200).json({ message: 'User updated successfully' });
    });

  } catch (err) {
    console.error('Error during file copy or user update:', err);
    return res.status(500).json({ message: 'Error during update process', error: err });
  }
});



// login  ของ user  ด้วย  Users  and phone_number
// post http://127.0.0.1:3000/api/users/login
router.post('/login', (req, res) => {
  const { phone_number,password} = req.body;

  const query = `
    SELECT * FROM users WHERE phone_number = ? AND password = ?
  `;

  db.query(query, [phone_number, password], (err, results) => {
    if (err) return res.status(500).json({ message: 'Internal server error', error: err });

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid phone number or password' });
    }

    // For simplicity, we'll just return user data here. In a real-world scenario, 
    // you might generate a session token or a JWT (JSON Web Token).
    const user = results[0];
    res.status(200).json({
      message: 'Login successful',
      user: {
        user_id: user.user_id,
        name: user.name,
        phone_number: user.phone_number,
        user_type: user.user_type,
        user_image: user.user_image,
        address: user.address
      }
    });
  });
});


// API  ค้นหา  user  จาก  user_id
//  http://127.0.0.1:3000/api/users/1
router.get('/:user_id', (req, res) => {
  const { user_id } = req.params;

  const query = `SELECT * FROM Users WHERE user_id = ?`;

  db.query(query, [user_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Internal server error', error: err });

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = results[0];
    
    // Check if gps_location is null, to avoid errors when accessing x and y properties
    let gps_location = null;
    if (user.gps_location) {
      gps_location = {
        x: user.gps_location.x,
        y: user.gps_location.y
      };
    }

    res.status(200).json({
      message: 'User found',
      user: {
        user_id: user.user_id,
        phone_number: user.phone_number,
        name: user.name,
        user_image: user.user_image,
        address: user.address,
        gps_location: gps_location, // Set to null if gps_location is null
        user_type: user.user_type
      }
    });
  });
});





// API  ค้นหา  user    ที่เป็น (ผู้รับ)user_type = 'Receiver'  จาก  phone_number 
router.get('/phone/:phone_number', (req, res) => {
  const { phone_number } = req.params;

  const query = `SELECT * FROM Users WHERE phone_number = ? AND user_type = 'Receiver'`;

  db.query(query, [phone_number], (err, results) => {
    if (err) return res.status(500).json({ message: 'Internal server error', error: err });

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found or user is not a Receiver' });
    }

    const user = results[0];
    
    // Check if gps_location is null, to avoid errors when accessing x and y properties
    let gps_location = null;
    if (user.gps_location) {
      gps_location = {
        x: user.gps_location.x,
        y: user.gps_location.y
      };
    }

    res.status(200).json({
      message: 'User found',
      user: {
        user_id: user.user_id,
        phone_number: user.phone_number,
        name: user.name,
        user_image: user.user_image,
        address: user.address,
        gps_location: gps_location, // Set to null if gps_location is null
        user_type: user.user_type
      }
    });
  });
});






//http://127.0.0.1:3000/api/users
router.get('/', (req, res) => {
  const query = 'SELECT * FROM Users';

  db.query(query, (err, results) => {
    if (err) return res.status(500).json(err);
    
    // Return all user data
    res.status(200).json(results);
  });
});

module.exports = router;