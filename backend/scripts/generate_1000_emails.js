const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const firstNames = [
    // Male
    'James', 'Oliver', 'Liam', 'Noah', 'Jack', 'Henry', 'William', 'Lucas', 'Leo', 'Benjamin',
    'Samuel', 'Ethan', 'Alexander', 'Daniel', 'Thomas', 'Matthew', 'David', 'Joseph', 'Michael', 'Charles',
    'Harry', 'George', 'Arthur', 'Oscar', 'Jacob', 'Freddie', 'Alfie', 'Archie', 'Isaac', 'Joshua',
    'Dylan', 'Ryan', 'Nathan', 'Luke', 'Adam', 'Caleb', 'Toby', 'Connor', 'Aaron', 'Harrison',
    'Edward', 'Theo', 'Elijah', 'Mason', 'Logan', 'Sebastian', 'Gabriel', 'Jackson', 'Carter', 'Jayden',
    'John', 'Owen', 'Wyatt', 'Julian', 'Levi', 'Isaiah', 'Anthony', 'Lincoln', 'Hudson', 'Christian',
    'Hunter', 'Andrew', 'Adrian', 'Miles', 'Nolan', 'Ezekiel', 'Axel', 'Easton', 'Colton', 'Luca',
    'Eli', 'Jonathan', 'Santiago', 'Cooper', 'Angel', 'Roman', 'Ian', 'Robert', 'Nicholas', 'Dominic',
    'Austin', 'Xavier', 'Kai', 'Parker', 'Silas', 'Declan', 'Rowan', 'Weston', 'Christopher', 'Zachary',
    'Brandon', 'Tyler', 'Justin', 'Kevin', 'Jason', 'Brian', 'Eric', 'Scott', 'Timothy', 'Steven',

    // Female
    'Emma', 'Olivia', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
    'Abigail', 'Emily', 'Elizabeth', 'Mila', 'Ella', 'Avery', 'Sofia', 'Camila', 'Aria', 'Scarlett',
    'Victoria', 'Madison', 'Luna', 'Grace', 'Chloe', 'Penelope', 'Layla', 'Riley', 'Zoey', 'Nora',
    'Lily', 'Eleanor', 'Hannah', 'Lillian', 'Addison', 'Aubrey', 'Ellie', 'Stella', 'Natalie', 'Zoe',
    'Leah', 'Hazel', 'Violet', 'Aurora', 'Savannah', 'Audrey', 'Brooklyn', 'Bella', 'Claire', 'Skylar',
    'Lucy', 'Paisley', 'Everly', 'Anna', 'Caroline', 'Nova', 'Genesis', 'Emilia', 'Kennedy', 'Samantha',
    'Maya', 'Willow', 'Kinsley', 'Naomi', 'Aaliyah', 'Elena', 'Sarah', 'Ariana', 'Allison', 'Gabriella',
    'Alice', 'Madelyn', 'Cora', 'Ruby', 'Eva', 'Serenity', 'Autumn', 'Adeline', 'Hailey', 'Gianna',
    'Valentina', 'Isla', 'Eliana', 'Quinn', 'Ivy', 'Sadie', 'Piper', 'Lydia', 'Alexa', 'Josephine',
    'Julia', 'Delilah', 'Vivian', 'Sophie', 'Brielle', 'Madeline', 'Peyton', 'Clara', 'Reagan', 'Mackenzie'
];

const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor',
    'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young',
    'Allen', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell',
    'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Parker', 'Collins', 'Edwards', 'Stewart',
    'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed', 'Bailey', 'Bell',
    'Kelly', 'Howard', 'Ward', 'Cox', 'Richardson', 'Watson', 'Brooks', 'Wood', 'James', 'Bennett',
    'Gray', 'Hughes', 'Price', 'Sanders', 'Myers', 'Long', 'Ross', 'Foster', 'Powell', 'Jenkins',
    'Perry', 'Russell', 'Sullivan', 'Butler', 'Barnes', 'Fisher', 'Henderson', 'Coleman', 'Simmons', 'Patterson',
    'Jordan', 'Reynolds', 'Hamilton', 'Graham', 'Griffin', 'Wallace', 'Cole', 'West', 'Hayes', 'Gibson',
    'Ellis', 'Stevens', 'Murray', 'Ford', 'Marshall', 'Owens', 'Harrison', 'Mcdonald', 'Woods', 'Kennedy'
];

const domain = 'risegrowthgroup.com';
const targetCount = 1000;
const accounts = [];
const usedUsernames = new Set();

let fIndex = 0;
let lIndex = 0;

while (accounts.length < targetCount) {
    const firstName = firstNames[fIndex % firstNames.length];
    const lastName = lastNames[lIndex % lastNames.length];
    
    // Create standard professional username: firstname.lastname
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;

    if (!usedUsernames.has(username)) {
        usedUsernames.add(username);
        const email = `${username}@${domain}`;
        const password = `Hi${username}@123`;
        const senderName = `${firstName} ${lastName}`;

        accounts.push({
            username: username,
            email: email,
            password: password,
            senderName: senderName,
            dailyLimit: 500,
            smtpHost: 'smtp.hostinger.com',
            smtpPort: 465
        });
    }

    fIndex++;
    if (fIndex % firstNames.length === 0) {
        lIndex++;
    }
}

console.log(`Generated ${accounts.length} distinct English accounts for @${domain}`);
console.log('Sample Row 1:', accounts[0]);
console.log('Sample Row 500:', accounts[499]);
console.log('Sample Row 1000:', accounts[999]);

// 1. Write to backend/hostinger_accounts_to_create.xlsx (for the Puppeteer creator script)
const wb1 = xlsx.utils.book_new();
const ws1 = xlsx.utils.json_to_sheet(accounts);
xlsx.utils.book_append_sheet(wb1, ws1, 'Hostinger_1000_Accounts');
const dest1 = path.join(__dirname, '../hostinger_accounts_to_create.xlsx');
xlsx.writeFile(wb1, dest1);
console.log(`✓ Saved: ${dest1}`);

// 2. Write to root 1000_risegrowthgroup_emails.xlsx (for user convenient access & CRM bulk import)
const dest2 = path.join(__dirname, '../../1000_risegrowthgroup_emails.xlsx');
xlsx.writeFile(wb1, dest2);
console.log(`✓ Saved: ${dest2}`);

// 3. Write to root 1000_risegrowthgroup_emails.csv (for CSV users)
const csvContent = xlsx.utils.sheet_to_csv(ws1);
const dest3 = path.join(__dirname, '../../1000_risegrowthgroup_emails.csv');
fs.writeFileSync(dest3, csvContent, 'utf-8');
console.log(`✓ Saved: ${dest3}`);
