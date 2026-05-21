require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs').promises; // Added fs.promises for file operations
const { main } = require('./bot.js');


const app = express();
const server = http.createServer(app);
const io = new Server(server);


const PORT = process.env.PORT || 2367;
const LEADS_FILE = path.join(__dirname, 'leads.json'); // Defined path to leads.json


let isBotRunning = false;


// Function to load leads from leads.json
async function loadLeads() {
    try {
        const data = await fs.readFile(LEADS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('leads.json not found, starting with empty leads.');
            return [];
        }
        console.error('Error loading leads:', error);
        return [];
    }
}

// Function to save leads to leads.json
async function saveLeads(leads) {
    try {
        await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
        console.log('Leads saved successfully.');
    } catch (error) {
        console.error('Error saving leads:', error);
    }
}


app.use(express.static(path.join(__dirname)));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


io.on('connection', (socket) => {
    console.log('a user connected');

    // Send current leads to the newly connected client
    loadLeads().then(leads => {
        socket.emit('leads-updated', leads);
    });

    socket.on('delete-phone-number', async ({ website, number }) => {
        console.log(`Received request to delete number: ${number} from website: ${website}`);
        let leads = await loadLeads();

        let leadFound = false;
        leads = leads.map(lead => {
            if (lead.website === website) {
                const initialPhoneNumbersCount = lead.phoneNumbers.length;
                lead.phoneNumbers = lead.phoneNumbers.filter(pn => pn !== number);
                if (lead.phoneNumbers.length < initialPhoneNumbersCount) {
                    leadFound = true;
                    console.log(`Deleted number ${number} from ${website}. Remaining numbers: ${lead.phoneNumbers.length}`);
                }
            }
            return lead;
        });

        if (leadFound) {
            await saveLeads(leads);
            // Emit updated leads to all connected clients
            io.emit('leads-updated', leads);
        } else {
            console.log(`Number ${number} not found for website ${website}. No changes made.`);
        }
    });

    socket.on('delete-all-phones-for-website', async ({ website }) => {
        console.log(`Received request to delete all phone numbers for website: ${website}`);
        let leads = await loadLeads();

        let leadFound = false;
        leads = leads.map(lead => {
            if (lead.website === website) {
                if (lead.phoneNumbers && lead.phoneNumbers.length > 0) {
                    lead.phoneNumbers = [];
                    leadFound = true;
                    console.log(`Deleted all phone numbers for ${website}.`);
                }
            }
            return lead;
        });

        if (leadFound) {
            await saveLeads(leads);
            io.emit('leads-updated', leads);
        } else {
            console.log(`Website ${website} not found or had no phone numbers. No changes made.`);
        }
    });

    socket.on('delete-email', async ({ website, email }) => {
        console.log(`Received request to delete email: ${email} from website: ${website}`);
        let leads = await loadLeads();

        let leadFound = false;
        leads = leads.map(lead => {
            if (lead.website === website) {
                const initialEmailsCount = lead.emails.length;
                lead.emails = lead.emails.filter(e => e !== email);
                if (lead.emails.length < initialEmailsCount) {
                    leadFound = true;
                    console.log(`Deleted email ${email} from ${website}. Remaining emails: ${lead.emails.length}`);
                }
            }
            return lead;
        });

        if (leadFound) {
            await saveLeads(leads);
            io.emit('leads-updated', leads);
        } else {
            console.log(`Email ${email} not found for website ${website}. No changes made.`);
        }
    });

    socket.on('delete-all-emails-for-website', async ({ website }) => {
        console.log(`Received request to delete all emails for website: ${website}`);
        let leads = await loadLeads();

        let leadFound = false;
        leads = leads.map(lead => {
            if (lead.website === website) {
                if (lead.emails && lead.emails.length > 0) {
                    lead.emails = [];
                    leadFound = true;
                    console.log(`Deleted all emails for ${website}.`);
                }
            }
            return lead;
        });

        if (leadFound) {
            await saveLeads(leads);
            io.emit('leads-updated', leads);
        } else {
            console.log(`Website ${website} not found or had no emails. No changes made.`);
        }
    });

    socket.on('delete-website', async ({ website }) => {
        console.log(`Received request to delete website: ${website}`);
        let leads = await loadLeads();

        const initialLeadsCount = leads.length;
        leads = leads.filter(lead => lead.website !== website);

        if (leads.length < initialLeadsCount) {
            await saveLeads(leads);
            io.emit('leads-updated', leads);
            console.log(`Website ${website} and all its data deleted.`);
        } else {
            console.log(`Website ${website} not found. No changes made.`);
        }
    });

        socket.on('request-latest-leads', async () => {
        console.log('Client requested latest leads.');
        const leads = await loadLeads();
        socket.emit('leads-updated', leads); // Emit to the requesting client
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});


server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
    console.log('Server started and bot main function is about to be called.');
    // Initial call to start the bot immediately
    main(io, loadLeads, saveLeads);
    // Schedule the bot to run every 1hour (3600000 1hour)
    setInterval(() => {
        if (!isBotRunning) {
            console.log('Running bot main function on schedule...');
            isBotRunning = true;
            main(io, loadLeads, saveLeads).finally(() => {
                isBotRunning = false;
            });
        } else {
            console.log('Bot is still running, skipping this interval.');
        }
    }, 3600000);
});