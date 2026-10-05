const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/new_crm', {
            serverSelectionTimeoutMS: 5000,
            family: 4 // Force IPv4 to prevent connection delays on Windows/Docker
        });
        console.log(`✓ MongoDB Connected: ${conn.connection.host}`);

        // Auto-seed default Master Admin account if not exists
        const User = require('../models/User');
        const adminExists = await User.findOne({ email: 'admin@crm.com' });
        if (!adminExists) {
            await User.create({
                name: 'Master Admin',
                email: 'admin@crm.com',
                password: 'admin123',
                role: 'master',
                designation: 'System Master'
            });
            console.log('✅ Default Master Admin account seeded: admin@crm.com / admin123');
        }
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
