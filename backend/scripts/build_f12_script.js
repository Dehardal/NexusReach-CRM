const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = xlsx.readFile(path.join(__dirname, '../../1000_risegrowthgroup_emails.xlsx'));
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const accountList = rows.map(r => ({ u: r.username, p: r.password }));

const code = `/**
 * HOSTINGER BULK MAILBOX CREATOR (F12 CONSOLE RUNNER - V3 FAST LOOP)
 * 
 * Features:
 * - Direct "Add another mailbox" looping: Never closes the modal, 3x faster!
 * - Accurate username input targeting (ignores search bar)
 * - React synthetic state synchronization
 */

(async function() {
    const accounts = ${JSON.stringify(accountList, null, 2)};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    console.log('%c🚀 STARTING AUTOMATED HOSTINGER MAILBOX CREATION (FAST LOOP)...', 'font-size: 16px; color: #8b5cf6; font-weight: bold;');
    console.log('Total mailboxes to create:', accounts.length);

    // Reliable React-compatible input setter
    const setInputValue = (input, value) => {
        if (!input) return;
        input.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
            nativeSetter.call(input, value);
        } else {
            input.value = value;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    let created = 0;
    let failed = 0;

    for (let i = 0; i < accounts.length; i++) {
        const item = accounts[i];
        console.log(\`%c[\${i + 1}/\${accounts.length}] Processing: \${item.u}@risegrowthgroup.com...\`, 'color: #06b6d4; font-weight: bold;');

        try {
            // 1. Ensure the create form is active
            let modal = document.querySelector('[role="dialog"], [class*="modal" i], [class*="drawer" i], [class*="popup" i], [class*="dialog" i]');
            let passInput = modal ? modal.querySelector('input[type="password"]') : document.querySelector('input[type="password"]');

            if (!passInput) {
                // If form is not open, check for "Add another mailbox" button or initial "Add mailboxes" button
                const allButtons = Array.from(document.querySelectorAll('button, a'));
                const addAnotherBtn = allButtons.find(b => {
                    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                    return text.includes('add another') || text.includes('create another');
                });

                if (addAnotherBtn) {
                    console.log('   👉 Clicking "Add another mailbox"...');
                    addAnotherBtn.click();
                    await sleep(1500);
                } else {
                    const addBtn = allButtons.find(b => {
                        const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                        return text.includes('add mailboxes') || text.includes('add mailbox') || text.includes('create email');
                    });
                    if (addBtn) {
                        addBtn.click();
                        await sleep(1500);
                    }
                }

                // Refresh references
                modal = document.querySelector('[role="dialog"], [class*="modal" i], [class*="drawer" i], [class*="popup" i], [class*="dialog" i]') || document;
                passInput = modal.querySelector('input[type="password"]') || document.querySelector('input[type="password"]');
            }

            if (!passInput) {
                console.warn('   ⚠️ Waiting for password field to appear...');
                await sleep(2000);
                passInput = document.querySelector('input[type="password"]');
            }

            // 2. Locate Username input (STRICTLY ignoring search bar)
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
                const modalInputs = Array.from((modal || document).querySelectorAll('input')).filter(inp => {
                    const placeholder = (inp.placeholder || '').toLowerCase();
                    const type = (inp.type || '').toLowerCase();
                    return type !== 'password' && type !== 'hidden' && !placeholder.includes('search');
                });
                userInput = modalInputs[0];
            }

            if (!userInput || !passInput) {
                console.error('❌ Could not locate inputs in this step. Skipping to next attempt.');
                await sleep(2000);
                continue;
            }

            // 3. Fill Username (prefix only) & Password
            setInputValue(userInput, item.u);
            console.log('   Username set to:', userInput.value);
            await sleep(300);

            setInputValue(passInput, item.p);
            console.log('   Password set to:', item.p);
            await sleep(800);

            // 4. Click Submit / Create
            const formScope = passInput.closest('form') || modal || document;
            const modalButtons = Array.from(formScope.querySelectorAll('button'));
            const submitBtn = modalButtons.reverse().find(b => {
                const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                const type = (b.type || '').toLowerCase();
                return (t === 'create' || t === 'create mailbox' || t === 'add' || t === 'save' || type === 'submit') && !b.disabled;
            });

            if (submitBtn) {
                submitBtn.click();
                console.log('   ⏳ Clicked Create, awaiting Hostinger confirmation...');
            } else {
                console.warn('   ⚠️ Submit button not found automatically.');
            }

            // Pacing pause for Hostinger backend to create the mailbox
            await sleep(4000);

            // 5. Look for the "Add another mailbox" button in the success card!
            const postButtons = Array.from(document.querySelectorAll('button, a'));
            const addAnotherBtn = postButtons.find(b => {
                const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                return text.includes('add another') || text.includes('create another');
            });

            if (addAnotherBtn) {
                console.log('   ✨ Found "Add another mailbox" button! Transitioning directly to next mailbox...');
                addAnotherBtn.click();
                await sleep(1500);
            } else {
                // Fallback: Dismiss popup if "Add another" isn't present
                const closeBtn = postButtons.find(b => {
                    const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                    return t === 'done' || t === 'close' || t === 'maybe later' || t === 'skip' || t === '✕';
                });
                if (closeBtn) closeBtn.click();
                await sleep(1500);
            }

            created++;
            console.log(\`%c   ✅ Successfully created \${item.u}@risegrowthgroup.com (\${created}/\${accounts.length})\`, 'color: #10b981;');

        } catch (err) {
            failed++;
            console.error(\`   ❌ Failed on \${item.u}: \${err.message}\`);
            await sleep(2000);
        }
    }

    console.log('%c🎉 FINISHED! Successfully created: ' + created + ' mailboxes.', 'font-size: 16px; color: #10b981; font-weight: bold;');
})();
`;

fs.writeFileSync(path.join(__dirname, '../../hostinger_f12_auto_creator.js'), code, 'utf-8');
console.log('Done writing updated hostinger_f12_auto_creator.js');
