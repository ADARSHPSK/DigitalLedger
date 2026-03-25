/**
 * BhoomiLedger — Dev Seed Script
 * Run once:  node seed.js
 *
 * Creates:
 *   • 4 users  — admin, official (Patwari), owner1 (Mohan Lal), owner2 (Sunita Devi)
 *   • 6 land records in villages Rampur / Sitapur (UP)
 *
 * This script is safe to re-run — it wipes ALL existing Users and Lands first.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Land = require('./models/Land');

const MONGO_URI = process.env.MONGO_URI;

async function seed() {
  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.\n');

  // ── 1. Wipe existing data ──────────────────────────────────────────────────
  await User.deleteMany({});
  await Land.deleteMany({});
  console.log('🗑️  Cleared existing Users and Lands.\n');

  // ── 2. Hash passwords (bypassing the pre-save hook by using insertMany) ────
  //       We use User.create() one-by-one so the pre-save hook fires and hashes
  //       passwords automatically.

  // Admin
  const admin = await User.create({
    name: 'Admin (Tehsildar)',
    phone: '0000000000',
    password: 'admin123',
    role: 'admin',
    designation: 'Tehsildar',
  });

  // Official — Patwari assigned to Rampur and Sitapur
  const official = await User.create({
    name: 'Ram Singh',
    phone: '1111111111',
    password: 'officer123',
    role: 'official',
    designation: 'Patwari',
    assignedVillages: ['Rampur', 'Sitapur'],
  });

  // Owner 1 — Mohan Lal (2 plots)
  const owner1 = await User.create({
    name: 'Mohan Lal',
    phone: '2222222222',
    password: 'user123',
    role: 'owner',
    landRefs: [
      { khasraNo: 'KH-101', village: 'Rampur' },
      { khasraNo: 'KH-102', village: 'Rampur' },
    ],
  });

  // Owner 2 — Sunita Devi (1 plot)
  const owner2 = await User.create({
    name: 'Sunita Devi',
    phone: '3333333333',
    password: 'user123',
    role: 'owner',
    landRefs: [
      { khasraNo: 'KH-201', village: 'Sitapur' },
    ],
  });

  console.log('👥 Created 4 users:');
  console.log('   Admin       → phone: 0000000000  password: admin123');
  console.log('   Officer     → phone: 1111111111  password: officer123');
  console.log('   Owner 1     → phone: 2222222222  password: user123');
  console.log('   Owner 2     → phone: 3333333333  password: user123\n');

  // ── 3. Land records ────────────────────────────────────────────────────────

  const today = new Date();
  const yr = (n) => new Date(today.getFullYear() - n, 0, 15);

  // Helper — official comment sub-doc
  function makeComment(text, tag) {
    return {
      officialId: official._id,
      officialName: official.name,
      role: official.designation,
      text,
      tag,
      createdAt: new Date(),
    };
  }

  const lands = await Land.insertMany([
    // ── Rampur plots ──────────────────────────────────────────────────────────

    // 1. Mohan Lal — KH-101  (clear)
    {
      khasraNo: 'KH-101',
      village: 'Rampur',
      tehsil: 'Rampur Tehsil',
      district: 'Rampur',
      state: 'Uttar Pradesh',
      areaValue: 2.5,
      areaUnit: 'bigha',
      landType: 'agricultural',
      status: 'clear',
      currentOwner: 'Mohan Lal',
      ownershipHistory: [
        {
          ownerName: 'Ganga Ram (father)',
          transferType: 'original',
          date: yr(40),
          documentRef: 'PATTA-1984-001',
          recordedBy: 'Patwari Shyam Lal',
          notes: 'Original patta issued by government',
        },
        {
          ownerName: 'Mohan Lal',
          transferType: 'inheritance',
          date: yr(10),
          documentRef: 'WILL-2014-042',
          recordedBy: 'Ram Singh',
          notes: 'Inherited after father\'s death',
        },
      ],
      officialComments: [],
      tags: ['irrigated'],
    },

    // 2. Mohan Lal — KH-102  (under_review)
    {
      khasraNo: 'KH-102',
      village: 'Rampur',
      tehsil: 'Rampur Tehsil',
      district: 'Rampur',
      state: 'Uttar Pradesh',
      areaValue: 1.2,
      areaUnit: 'bigha',
      landType: 'agricultural',
      status: 'under_review',
      currentOwner: 'Mohan Lal',
      ownershipHistory: [
        {
          ownerName: 'Ganga Ram (father)',
          transferType: 'original',
          date: yr(38),
          documentRef: 'PATTA-1986-007',
          recordedBy: 'Patwari Shyam Lal',
          notes: 'Government allotted agricultural land',
        },
        {
          ownerName: 'Mohan Lal',
          transferType: 'inheritance',
          date: yr(10),
          documentRef: 'WILL-2014-042',
          recordedBy: 'Ram Singh',
          notes: 'Inherited from Ganga Ram',
        },
      ],
      officialComments: [
        makeComment(
          'Boundary survey pending. Neighbour Raju has raised a verbal complaint about eastern boundary.',
          'under_review'
        ),
      ],
      tags: ['boundary-issue'],
    },

    // 3. Raju Prasad — KH-103  (disputed)
    {
      khasraNo: 'KH-103',
      village: 'Rampur',
      tehsil: 'Rampur Tehsil',
      district: 'Rampur',
      state: 'Uttar Pradesh',
      areaValue: 3.0,
      areaUnit: 'bigha',
      landType: 'agricultural',
      status: 'disputed',
      currentOwner: 'Raju Prasad',
      ownershipHistory: [
        {
          ownerName: 'Bhagat Singh',
          transferType: 'original',
          date: yr(55),
          documentRef: 'PATTA-1969-003',
          recordedBy: 'Patwari Hari Prasad',
          notes: 'Original allotment post land reform act',
        },
        {
          ownerName: 'Raju Prasad',
          transferType: 'sale',
          date: yr(5),
          documentRef: 'SALE-DEED-2019-112',
          recordedBy: 'Ram Singh',
          notes: 'Purchased from heirs of Bhagat Singh. Second heir Geeta Devi disputes the sale.',
        },
      ],
      officialComments: [
        makeComment(
          'Geeta Devi (daughter of Bhagat Singh) has filed civil suit No. 342/2019 claiming her share was not included in sale deed.',
          'disputed'
        ),
        makeComment(
          'Court hearing scheduled for 15 April 2026. No transfer allowed until resolution.',
          'disputed'
        ),
      ],
      tags: ['court-case', 'encroachment'],
    },

    // 4. Village Panchayat — KH-104 (clear, govt land)
    {
      khasraNo: 'KH-104',
      village: 'Rampur',
      tehsil: 'Rampur Tehsil',
      district: 'Rampur',
      state: 'Uttar Pradesh',
      areaValue: 0.8,
      areaUnit: 'bigha',
      landType: 'govt',
      status: 'clear',
      currentOwner: 'Gram Panchayat Rampur',
      ownershipHistory: [
        {
          ownerName: 'Gram Panchayat Rampur',
          transferType: 'govt_allotment',
          date: yr(30),
          documentRef: 'GOVT-ORDER-1994-88',
          recordedBy: 'Ram Singh',
          notes: 'Allotted for primary school playground',
        },
      ],
      officialComments: [],
      tags: ['govt', 'school'],
    },

    // ── Sitapur plots ─────────────────────────────────────────────────────────

    // 5. Sunita Devi — KH-201  (clear)
    {
      khasraNo: 'KH-201',
      village: 'Sitapur',
      tehsil: 'Sitapur Tehsil',
      district: 'Sitapur',
      state: 'Uttar Pradesh',
      areaValue: 1.75,
      areaUnit: 'bigha',
      landType: 'residential',
      status: 'clear',
      currentOwner: 'Sunita Devi',
      ownershipHistory: [
        {
          ownerName: 'Ramesh Gupta',
          transferType: 'original',
          date: yr(25),
          documentRef: 'PATTA-1999-055',
          recordedBy: 'Patwari Brijesh',
          notes: 'Purchased from UPAVP scheme',
        },
        {
          ownerName: 'Sunita Devi',
          transferType: 'gift',
          date: yr(3),
          documentRef: 'GIFT-DEED-2021-007',
          recordedBy: 'Ram Singh',
          notes: 'Gifted to daughter Sunita Devi on her marriage',
        },
      ],
      officialComments: [],
      tags: ['residential'],
    },

    // 6. Abdul Karim — KH-202  (disputed, Sitapur)
    {
      khasraNo: 'KH-202',
      village: 'Sitapur',
      tehsil: 'Sitapur Tehsil',
      district: 'Sitapur',
      state: 'Uttar Pradesh',
      areaValue: 4.0,
      areaUnit: 'bigha',
      landType: 'agricultural',
      status: 'disputed',
      currentOwner: 'Abdul Karim',
      ownershipHistory: [
        {
          ownerName: 'Ahmed Khan',
          transferType: 'original',
          date: yr(60),
          documentRef: 'PATTA-1964-021',
          recordedBy: 'Patwari Hari Shankar',
          notes: 'Original patta',
        },
        {
          ownerName: 'Abdul Karim',
          transferType: 'inheritance',
          date: yr(15),
          documentRef: 'WILL-2009-034',
          recordedBy: 'Ram Singh',
          notes: 'Inherited by son Abdul Karim',
        },
      ],
      officialComments: [
        makeComment(
          'Encroachment of approx 0.5 bigha reported by Revenue Inspector. Physical verification done on 10 Mar 2026.',
          'disputed'
        ),
      ],
      tags: ['encroachment', 'verification-pending'],
    },
  ]);

  console.log(`🌾 Created ${lands.length} land records.\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seed complete! You can now log in with:');
  console.log('   Officer  → 1111111111 / officer123  (Official dashboard)');
  console.log('   Owner    → 2222222222 / user123     (My Lands)');
  console.log('   Owner 2  → 3333333333 / user123     (My Lands)');
  console.log('   Admin    → 0000000000 / admin123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
