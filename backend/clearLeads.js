const mongoose = require('mongoose');
const Lead = require('./models/Lead');
require('dotenv').config();

const clearLeads = async () => {
    try {
        console.log('Connecting to MongoDB database...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/new_crm', {
            serverSelectionTimeoutMS: 5000,
            family: 4
        });
        console.log('✓ Database Connected.');

        const result = await Lead.deleteMany({});
        console.log('\n======================================');
        console.log(`🗑️ SUCCESSFULLY CLEARED ALL LEADS!`);
        console.log(`Deleted Count: ${result.deletedCount} lead(s).`);
        console.log('======================================\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to clear leads:', error.message);
        process.exit(1);
    }
};

clearLeads();
