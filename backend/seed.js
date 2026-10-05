const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const seed = async () => {
    try {
        console.log('Connecting to MongoDB database...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/new_crm', {
            serverSelectionTimeoutMS: 5000,
            family: 4
        });
        console.log('✓ Database Connected.');

        // Clear existing default accounts to prevent duplicates
        const emails = ['master@crm.com', 'admin@crm.com', 'sales@crm.com', 'mailpedia@crm.com'];
        await User.deleteMany({ email: { $in: emails } });
        console.log('Cleaned old seed accounts.');

        // 1. Master User
        const master = await User.create({
            name: 'Master Architect',
            email: 'master@crm.com',
            password: 'master123',
            role: 'master',
            designation: 'Architect'
        });
        console.log(`✓ Seeded Master Account: ${master.email} / master123`);

        // 2. Admin User
        const admin = await User.create({
            name: 'System Admin',
            email: 'admin@crm.com',
            password: 'admin123',
            role: 'admin',
            designation: 'Administrator'
        });
        console.log(`✓ Seeded Admin Account: ${admin.email} / admin123`);

        // 3. Sales User
        const sales = await User.create({
            name: 'Sales Exec One',
            email: 'sales@crm.com',
            password: 'sales123',
            role: 'sales',
            designation: 'Admissions Counselor',
            assignedAdmin: admin._id
        });
        console.log(`✓ Seeded Sales Account: ${sales.email} / sales123`);

        // 4. Mail Pedia User (Email Marketing)
        const mailpedia = await User.create({
            name: 'Mail Pedia Specialist',
            email: 'mailpedia@crm.com',
            password: 'mailpedia123',
            role: 'mail_pedia',
            designation: 'Campaign Marketing Lead',
            assignedAdmin: admin._id
        });
        console.log(`✓ Seeded Mail Pedia Account: ${mailpedia.email} / mailpedia123`);

        console.log('\n======================================');
        console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
        console.log('======================================');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    }
};

seed();
