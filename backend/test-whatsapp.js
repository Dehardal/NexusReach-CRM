const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

async function test() {
    console.log('Testing WhatsApp initialization...');
    try {
        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '.wwebjs_auth')
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        
        console.log('Client instantiated. Calling initialize()...');
        await client.initialize();
        console.log('Initialize finished successfully!');
        process.exit(0);
    } catch (e) {
        console.error('ERROR CAUGHT:');
        console.error(e);
        process.exit(1);
    }
}

test();
