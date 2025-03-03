const express = require('express');
const router = express.Router();
const db = require('../db'); // Reuse DB connection from a shared file
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

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



// Create a new Multi-Item Order for a Delivery (with image upload)
router.post('/', upload.single('item_image'), async (req, res) => {
    const { delivery_id, item_description } = req.body;
    const item_image = req.file ? req.file.path : null;

    try {
        // If there's an image, attempt to copy it to the desired directory
        if (item_image) {
            const destination = path.join('D:', 'mysql', 'htdocs', 'uploads', path.basename(item_image));
            await fs.copyFile(item_image, destination); // Copy file using async/await
        }

        const query = `
            INSERT INTO Multi_Item_Orders (delivery_id, item_description, item_image)
            VALUES (?, ?, ?)
        `;

        db.query(
            query,
            [delivery_id, item_description, item_image],
            (err, result) => {
                if (err) return res.status(500).json({ message: 'Error creating multi-item order', error: err });
                res.status(201).json({ message: 'Multi-item order created', order_id: result.insertId });
            }
        );
    } catch (err) {
        console.error('Error copying file:', err);
        return res.status(500).json({ message: 'Error copying image file', error: err });
    }
});


// Get all Multi-Item Orders delivery_id
router.get('/multi-item-orders/:delivery_id', (req, res) => {
    const delivery_id = req.params.delivery_id;
    const query = `SELECT * FROM Multi_Item_Orders WHERE delivery_id = ?`;
    db.query(query, [delivery_id], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error fetching multi-item orders', error: err });
        res.status(200).json(results);
    });
});











  module.exports = router;