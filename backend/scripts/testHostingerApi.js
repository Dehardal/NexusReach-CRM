const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const apiManaged = await mongoose.connection.db.collection('mailboxes').countDocuments({ isApiManaged: true });
  const notApi = await mongoose.connection.db.collection('mailboxes').countDocuments({
    $or: [{ isApiManaged: false }, { isApiManaged: { $exists: false } }]
  });
  console.log('isApiManaged: true ->', apiManaged);
  console.log('not api managed ->', notApi);
  
  // Let's test an API-managed mailbox with SMTP connection
  const sampleApiMb = await mongoose.connection.db.collection('mailboxes').findOne({ isApiManaged: true });
  console.log('Sample API mailbox:', sampleApiMb.emailUser);

  const nodemailer = require('nodemailer');
  const { decrypt } = require('../utils/crypto');
  const pass = decrypt(sampleApiMb.emailPass);
  console.log('Testing SMTP for sample API mailbox with pass:', pass);
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: { user: sampleApiMb.emailUser, pass },
    connectionTimeout: 8000
  });

  try {
    await transporter.verify();
    console.log('✓ SMTP SUCCESS for', sampleApiMb.emailUser);
  } catch (err) {
    console.log('❌ SMTP FAILED for', sampleApiMb.emailUser, '->', err.message);
  }

  process.exit(0);
}

check().catch(console.error);
