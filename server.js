// server.js
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Import routes
const userRoutes = require('./routes/users');
const riderRoutes = require('./routes/riders');
const deliveryRoutes = require('./routes/deliveries');
const locationTrackingRoutes = require('./routes/locationTracking');
const multi_Item_ordersRoutes = require('./routes/multi_Item_orders');
const delivery_lmagesRoutes = require('./routes/delivery_lmages');
// Use routes
app.use('/api/users', userRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/location_tracking', locationTrackingRoutes);
app.use('/api/multi_Item_orders', multi_Item_ordersRoutes)
app.use('/api/delivery_lmages', delivery_lmagesRoutes)
// Server Listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});