const xlsx = require('xlsx');
const path = require('path');

const sampleData = [
    { username: 'counselor1', password: 'ChangeMeHostinger@2026', senderName: 'Admissions Desk 1' },
    { username: 'counselor2', password: 'ChangeMeHostinger@2026', senderName: 'Admissions Desk 2' },
    { username: 'counselor3', password: 'ChangeMeHostinger@2026', senderName: 'Admissions Desk 3' },
    { username: 'outreach1', password: 'ChangeMeHostinger@2026', senderName: 'Senior Outreach' },
    { username: 'outreach2', password: 'ChangeMeHostinger@2026', senderName: 'Marketing Desk' }
];

const ws = xlsx.utils.json_to_sheet(sampleData);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Accounts');
xlsx.writeFile(wb, path.join(__dirname, '../hostinger_accounts_to_create.xlsx'));
console.log('Template created at backend/hostinger_accounts_to_create.xlsx');
