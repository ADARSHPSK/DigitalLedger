
require('dotenv').config();
const mongoose = require('mongoose');
const Land = require('./models/Land');
const User = require('./models/User');

async function testData() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // Find a land record
    const land = await Land.findOne({ khasraNo: 'KH-101' });
    const official = await User.findOne({ role: 'official' });

    if (!land || !official) {
        console.error('Missing records. Run seed first.');
        process.exit(1);
    }

    console.log('Adding data to Khasra #101...');

    // 1. Add an official comment
    land.officialComments.push({
        officialId: official._id,
        officialName: official.name,
        text: 'Physical verification successful. No encroachment found.',
        tag: 'clear',
        createdAt: new Date()
    });
    land.status = 'clear';

    // 2. IMPORTANT: THE TIMELINE IS SEPARATE
    // We are NOT adding anything to ownershipHistory here.
    
    await land.save();
    console.log('Updated Khasra #101. Comment added, status set to "clear".');
    console.log('NOTE: The "Ownership History" (Timeline) remains unchanged.');

    await mongoose.disconnect();
}

testData().catch(console.error);
