const path = require('path');
const fs = require('fs');
const readline = require('readline');
const xlsx = require('xlsx');
const { spawn, execSync } = require('child_process');

// Try requiring puppeteer from backend/node_modules
let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    try {
        puppeteer = require(path.join(__dirname, '../node_modules/puppeteer'));
    } catch (e2) {
        console.error('Puppeteer not found. Please run: npm install puppeteer');
        process.exit(1);
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Sleep utility
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    console.log('\n============================================================');
    console.log('   🚀 HOSTINGER BULK EMAIL CREATOR (PUPPETEER AUTOMATION)   ');
    console.log('============================================================\n');

    console.log('Choose how you want to provide your accounts to create:');
    console.log('  1) Auto-Generate Sequential Accounts (e.g. counselor1, counselor2, etc.)');
    console.log('  2) Read from Excel sheet (backend/hostinger_accounts_to_create.xlsx)\n');

    const choice = (await askQuestion('Enter choice (1 or 2, default is 1): ')).trim() || '1';

    let accountsToCreate = [];
    let domainName = '';

    if (choice === '1') {
        domainName = (await askQuestion('\nEnter your Hostinger domain (e.g. mycompany.com): ')).trim();
        if (!domainName) {
            console.error('❌ Domain name is required.');
            process.exit(1);
        }
        domainName = domainName.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

        const prefix = (await askQuestion('Enter email prefix (e.g. counselor or outreach) [default: outreach]: ')).trim() || 'outreach';
        const countStr = (await askQuestion('How many mailboxes to create (e.g. 5, 10, 20) [default: 10]: ')).trim() || '10';
        const count = parseInt(countStr, 10) || 10;
        const defaultPassword = (await askQuestion('Enter strong password for all accounts (e.g. MyHostingerPass@2026): ')).trim();

        if (!defaultPassword || defaultPassword.length < 8) {
            console.error('❌ Please provide a valid strong password (at least 8 chars, 1 uppercase, 1 number).');
            process.exit(1);
        }

        const senderDisplayName = (await askQuestion('Enter default sender display name [default: Admissions Desk]: ')).trim() || 'Admissions Desk';

        for (let i = 1; i <= count; i++) {
            const userPart = `${prefix}${i}`;
            accountsToCreate.push({
                username: userPart,
                email: `${userPart}@${domainName}`,
                password: defaultPassword,
                senderName: `${senderDisplayName} ${i}`
            });
        }

    } else {
        // Mode 2: Read Excel
        const excelPath = path.join(__dirname, '../hostinger_accounts_to_create.xlsx');
        if (!fs.existsSync(excelPath)) {
            // Create a sample template if not existing
            const sampleData = [
                { username: 'outreach1', password: 'YourStrongPassword123!', senderName: 'Admissions 1' },
                { username: 'outreach2', password: 'YourStrongPassword123!', senderName: 'Admissions 2' },
                { username: 'counselor', password: 'YourStrongPassword123!', senderName: 'Counselor Desk' }
            ];
            const ws = xlsx.utils.json_to_sheet(sampleData);
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, 'Accounts');
            xlsx.writeFile(wb, excelPath);
            console.log(`\n⚠️ Created sample template at: ${excelPath}`);
            console.log('Please edit this Excel file with your desired usernames and passwords, then re-run this script.');
            process.exit(0);
        }

        const workbook = xlsx.readFile(excelPath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        domainName = (await askQuestion('\nEnter your Hostinger domain (e.g. mycompany.com): ')).trim().toLowerCase();

        for (const row of rows) {
            const user = (row.username || row.email || row.user || '').trim().replace(/@.*$/, '');
            const pass = (row.password || row.pass || '').trim();
            const name = (row.senderName || row.name || user).trim();

            if (user && pass) {
                accountsToCreate.push({
                    username: user,
                    email: `${user}@${domainName}`,
                    password: pass,
                    senderName: name
                });
            }
        }
    }

    if (accountsToCreate.length === 0) {
        console.error('❌ No valid accounts found to create.');
        process.exit(1);
    }

    console.log(`\n📋 Loaded ${accountsToCreate.length} accounts to create for domain: @${domainName}`);
    console.log('Sample account:', accountsToCreate[0].email);

    console.log('\n🌐 Browser Connection Options:');
    console.log('  1) Connect to your EXISTING open Chrome (Where you are already logged in) [Recommended]');
    console.log('  2) Launch real Chrome with your saved User Profile (Keeps logins)');
    console.log('  3) Launch a fresh Chrome window (Manual one-time login)\n');

    const browserChoice = (await askQuestion('Enter choice (1, 2, or 3, default is 1): ')).trim() || '1';
    let browser;
    let page;

    if (browserChoice === '1') {
        console.log('\n🔍 Checking for running Chrome with debugging on port 9222...');
        try {
            browser = await puppeteer.connect({
                browserURL: 'http://127.0.0.1:9222',
                defaultViewport: null
            });
            console.log('✅ Successfully connected to your existing Chrome browser!');
        } catch (err) {
            console.log('⚠️ No Chrome instance is currently listening on port 9222.');
            console.log('\nTo launch your existing Chrome with remote debugging:');
            console.log('  👉 Run: npm run chrome-debug');
            console.log('  Or in PowerShell: & "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222\n');

            const startNow = (await askQuestion('Would you like me to launch Chrome on port 9222 for you right now? (y/n): ')).trim().toLowerCase();
            if (startNow === 'y' || startNow === 'yes') {
                const chromeExe = process.platform === 'win32'
                    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                    : 'google-chrome';
                const automationProfile = path.join(process.env.USERPROFILE || require('os').homedir(), '.chrome-automation');
                spawn(chromeExe, [
                    '--remote-debugging-port=9222',
                    `--user-data-dir=${automationProfile}`,
                    '--start-maximized'
                ], { detached: true, stdio: 'ignore' }).unref();

                console.log('⏳ Starting Chrome with remote debugging on port 9222...');
                let connected = false;
                for (let attempt = 1; attempt <= 12; attempt++) {
                    await sleep(1000);
                    try {
                        browser = await puppeteer.connect({
                            browserURL: 'http://127.0.0.1:9222',
                            defaultViewport: null
                        });
                        connected = true;
                        break;
                    } catch (_) {}
                }

                if (!connected) {
                    console.error('❌ Could not connect to Chrome on port 9222.');
                    console.log('👉 Tip: Run `npm run chrome-debug` in a separate terminal and re-run.');
                    process.exit(1);
                }
                console.log('✅ Connected to Chrome on port 9222!');
            } else {
                console.log('❌ Connection cancelled. Please run `npm run chrome-debug` first.');
                process.exit(1);
            }
        }

        // Check if Hostinger is already open in any existing tab
        const pages = await browser.pages();
        const existingHostinger = pages.find(p => p.url().includes('hostinger.com'));
        if (existingHostinger) {
            page = existingHostinger;
            console.log(`✅ Using existing open Hostinger tab: ${page.url()}`);
            await page.bringToFront();
        } else {
            page = pages.length > 0 ? pages[0] : await browser.newPage();
            console.log('➡️ Opening https://hpanel.hostinger.com...');
            await page.goto('https://hpanel.hostinger.com', { waitUntil: 'networkidle2' });
        }

    } else if (browserChoice === '2') {
        const userDataDir = path.join(process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'), 'Google/Chrome/User Data');
        console.log(`\nUsing saved Chrome Profile: ${userDataDir}`);
        console.log('⚠️ Please ensure any other open Chrome windows are closed so the profile can load.');
        try {
            browser = await puppeteer.launch({
                headless: false,
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                userDataDir: userDataDir,
                defaultViewport: null,
                args: ['--start-maximized', '--no-sandbox']
            });
            const pages = await browser.pages();
            page = pages.length > 0 ? pages[0] : await browser.newPage();
            await page.goto('https://hpanel.hostinger.com', { waitUntil: 'networkidle2' });
        } catch (launchErr) {
            console.error('\n❌ Could not launch profile (Chrome might already be running).');
            console.error('Error: ' + launchErr.message);
            console.log('👉 Try Option 1 instead (`npm run chrome-debug`) to connect without closing Chrome.');
            process.exit(1);
        }
    } else {
        // Mode 3: Fresh standalone browser
        console.log('\n🌐 Launching fresh Chrome window...');
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        const pages = await browser.pages();
        page = pages.length > 0 ? pages[0] : await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        console.log('➡️ Navigating to Hostinger hPanel login...');
        await page.goto('https://hpanel.hostinger.com', { waitUntil: 'networkidle2' });
    }

    console.log('\n========================================================================');
    console.log(' ⚠️  STEP CHECK:');
    console.log(' 1. Ensure you are logged into Hostinger hPanel.');
    console.log(' 2. Open: Emails -> Manage "' + domainName + '" -> Email Accounts.');
    console.log(' 3. Ensure the "Create email account" button is visible on your screen.');
    console.log('========================================================================\n');

    await askQuestion('👉 Once you are on the Hostinger "Email Accounts" page, press ENTER here to start: ');

    console.log('\n🤖 Starting automated creation loop for ' + accountsToCreate.length + ' mailboxes...\n');

    const createdAccounts = [];
    const failedAccounts = [];

    for (let i = 0; i < accountsToCreate.length; i++) {
        const item = accountsToCreate[i];
        console.log(`\n[${i + 1}/${accountsToCreate.length}] Creating: ${item.email}...`);

        try {
            // Find and click "Create email account" button
            const clickedCreateBtn = await page.evaluate(() => {
                // Look for buttons or links containing "Create email account", "Create account", "Add account", or plus icon
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const btn = buttons.find(b => {
                    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                    return text.includes('add mailboxes') ||
                           text.includes('add mailbox') ||
                           text.includes('create email account') || 
                           text.includes('create account') || 
                           text.includes('create email') ||
                           text === 'create' ||
                           b.getAttribute('data-testid')?.includes('create') ||
                           b.getAttribute('data-testid')?.includes('add');
                });

                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });

            if (!clickedCreateBtn) {
                console.warn(`   ⚠️ Could not find "Create email account" button. Waiting 3s and retrying...`);
                await sleep(3000);
            }

            // Wait for modal input fields to be visible
            await sleep(2000);

            // Fill username and password inside the modal
            const formFilled = await page.evaluate((u, p) => {
                const modal = document.querySelector('[role="dialog"], [class*="modal" i], [class*="drawer" i], [class*="popup" i], [class*="dialog" i]') || document;
                const passInput = modal.querySelector('input[type="password"]') || document.querySelector('input[type="password"]');

                let userInput = null;
                if (passInput) {
                    const form = passInput.closest('form') || passInput.closest('[role="dialog"]') || passInput.parentElement?.parentElement;
                    if (form) {
                        const formInputs = Array.from(form.querySelectorAll('input')).filter(inp => {
                            const type = (inp.type || '').toLowerCase();
                            const placeholder = (inp.placeholder || '').toLowerCase();
                            return type !== 'password' && type !== 'hidden' && type !== 'search' && !placeholder.includes('search') && !inp.disabled;
                        });
                        if (formInputs.length > 0) userInput = formInputs[0];
                    }
                }

                if (!userInput) {
                    const modalInputs = Array.from(modal.querySelectorAll('input')).filter(inp => {
                        const placeholder = (inp.placeholder || '').toLowerCase();
                        const type = (inp.type || '').toLowerCase();
                        return type !== 'password' && type !== 'hidden' && !placeholder.includes('search');
                    });
                    userInput = modalInputs[0];
                }

                const setVal = (input, val) => {
                    input.focus();
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                    if (nativeSetter) {
                        nativeSetter.call(input, val);
                    } else {
                        input.value = val;
                    }
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                };

                if (userInput && passInput) {
                    setVal(userInput, u);
                    setVal(passInput, p);
                    return { success: true };
                }

                return { success: false, reason: 'Inputs not found. User input: ' + !!userInput + ', Pass input: ' + !!passInput };
            }, item.username, item.password);

            if (!formFilled.success) {
                console.warn(`   ⚠️ Form inputs auto-fill warning: ${formFilled.reason}`);
                console.log(`   👉 Please click the username field in the browser and enter: ${item.username}`);
                await sleep(4000);
            }

            await sleep(1000);

            // Click submit/create button inside modal
            const submitted = await page.evaluate(() => {
                // Find modal container or submit button
                const buttons = Array.from(document.querySelectorAll('button'));
                const submitBtn = buttons.reverse().find(b => {
                    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                    const type = (b.type || '').toLowerCase();
                    return (text === 'create' || text === 'create account' || text === 'create email account' || type === 'submit') && !b.disabled;
                });

                if (submitBtn) {
                    submitBtn.click();
                    return true;
                }
                return false;
            });

            if (submitted) {
                console.log(`   ⏳ Submitted form, waiting for Hostinger confirmation...`);
            }

            // Wait for Hostinger to process account creation (usually 3–5 seconds)
            await sleep(4500);

            // Look for "Add another mailbox" button in the success card for continuous loop!
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const addAnotherBtn = buttons.find(b => {
                    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                    return text.includes('add another') || text.includes('create another');
                });

                if (addAnotherBtn) {
                    addAnotherBtn.click();
                } else {
                    const closeBtn = buttons.find(b => {
                        const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                        return text === 'done' || text === 'close' || text === 'maybe later' || text === 'skip' || text === 'cancel' || text === '✕';
                    });
                    if (closeBtn) closeBtn.click();
                }
            });

            console.log(`   ✅ [SUCCESS] Created ${item.email}`);
            createdAccounts.push(item);

            // Short pause between creations to stay within Hostinger UI pacing
            await sleep(2500);

        } catch (err) {
            console.error(`   ❌ Failed to create ${item.email}: ${err.message}`);
            failedAccounts.push({ ...item, error: err.message });
        }
    }

    console.log('\n============================================================');
    console.log(`   FINISHED! Successfully created: ${createdAccounts.length} / ${accountsToCreate.length}`);
    if (failedAccounts.length > 0) {
        console.log(`   ⚠️ Failed/Skipped: ${failedAccounts.length}`);
    }
    console.log('============================================================\n');

    // Export results directly into an Excel sheet formatted for the CRM Bulk Import!
    if (createdAccounts.length > 0) {
        const exportData = createdAccounts.map(acc => ({
            email: acc.email,
            password: acc.password,
            senderName: acc.senderName,
            dailyLimit: 500,
            smtpHost: 'smtp.hostinger.com',
            smtpPort: 465
        }));

        const outWs = xlsx.utils.json_to_sheet(exportData);
        const outWb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(outWb, outWs, 'CRM_Mailboxes');

        const outPath = path.join(__dirname, '../created_hostinger_mailboxes_for_crm.xlsx');
        xlsx.writeFile(outWb, outPath);

        console.log(`🎉 READY FOR CRM IMPORT:`);
        console.log(`   A ready-to-use file was saved to:`);
        console.log(`   📁 ${outPath}`);
        console.log(`\n👉 You can now go to CRM -> "Hostinger Mailboxes" -> click "Bulk Import (Excel / Text)", upload this file, and all ${createdAccounts.length} mailboxes will be connected instantly!\n`);
    }

    await askQuestion('Press ENTER to close the browser and exit...');
    await browser.close();
    rl.close();
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
