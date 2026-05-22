const socket = io();
console.log('Socket.io client initialized.');

const runScraperBtn = document.getElementById('run-scraper-btn');
const copyAllWebsitesBtn = document.getElementById('copy-all-websites-btn');
const copyAllEmailsBtn = document.getElementById('copy-all-emails-btn');
const dataContainer = document.getElementById('data-container');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');

let allLeads = JSON.parse(localStorage.getItem('allLeads')) || [];
let currentPage = 1;
const leadsPerPage = 10;

function mergeLeads(newLeads) {
    newLeads.forEach(newLead => {
        const existingLeadIndex = allLeads.findIndex(lead => lead.website === newLead.website);
        if (existingLeadIndex > -1) {
            // Update existing lead
            allLeads[existingLeadIndex] = { ...allLeads[existingLeadIndex], ...newLead };
        } else {
            // Add new lead
            allLeads.push(newLead);
        }
    });
    // Sort leads by scrapedAt in descending order (most recent first)
    allLeads.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
    localStorage.setItem('allLeads', JSON.stringify(allLeads));
    renderLeads();
}

function renderLeads() {
    dataContainer.innerHTML = '';
    const lists = {};

    const sortedLeads = allLeads.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
    const startIndex = (currentPage - 1) * leadsPerPage;
    const endIndex = startIndex + leadsPerPage;
    const paginatedLeads = sortedLeads.slice(startIndex, endIndex);

    paginatedLeads.forEach(lead => {
        if (!lead.emails) {
            lead.emails = lead.email ? [lead.email] : [];
        }
        if (!lists[lead.industry]) {
            lists[lead.industry] = [];
        }
        lists[lead.industry].push(lead);
    });
    
    

    for (const industry in lists) {
        const industryLeads = lists[industry];
        const listContainer = document.createElement('div');
        listContainer.className = 'list-container';

        const title = document.createElement('h2');
        title.textContent = industry;
        listContainer.appendChild(title);

        industryLeads.forEach(lead => {
            const leadDiv = document.createElement('div');
            leadDiv.className = 'lead';
            leadDiv.style.marginBottom = '35px';

            const websiteSpan = document.createElement('span');
            websiteSpan.className = 'lead-website';
            websiteSpan.textContent = lead.website;
            // websiteSpan.style.wordBreak = 'break-all';
            leadDiv.appendChild(websiteSpan);
            leadDiv.appendChild(document.createElement('br'));

            const emailsLabel = document.createElement('strong');
            emailsLabel.textContent = 'Emails:';
            leadDiv.appendChild(emailsLabel);
            leadDiv.appendChild(document.createElement('br'));

            lead.emails.forEach(email => {
                const emailEntryDiv = document.createElement('div');
                emailEntryDiv.className = 'email-entry';

                const emailSpan = document.createElement('span');
                emailSpan.className = 'lead-email';
                emailSpan.textContent = email;
                emailEntryDiv.appendChild(emailSpan);

                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-email-btn';
                copyBtn.textContent = 'Copy';
                copyBtn.addEventListener('click', (e) => {
                    navigator.clipboard.writeText(email);
                    e.target.classList.add('clicked');
                    setTimeout(() => e.target.classList.remove('clicked'), 200);
                });
                emailEntryDiv.appendChild(copyBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-email-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                socket.emit('delete-email', { website: lead.website, email: email }); // MODIFIED LINE
                e.target.classList.add('clicked');
                setTimeout(() => e.target.classList.remove('clicked'), 200);
            });
                emailEntryDiv.appendChild(deleteBtn);

                leadDiv.appendChild(emailEntryDiv);
            });

            // Add "Copy All Emails for this Website" button
            const copyAllEmailsForWebsiteBtn = document.createElement('button');
            copyAllEmailsForWebsiteBtn.className = 'copy-btn';
            copyAllEmailsForWebsiteBtn.textContent = `Copy All Emails for ${lead.website}`;
            copyAllEmailsForWebsiteBtn.addEventListener('click', (e) => {
                const textToCopy = lead.emails.join('\n');
                navigator.clipboard.writeText(textToCopy);
                e.target.classList.add('clicked');
                setTimeout(() => e.target.classList.remove('clicked'), 200);
            });
            leadDiv.appendChild(copyAllEmailsForWebsiteBtn);

            // Add "Delete All Emails for this Website" button
            const deleteAllEmailsForWebsiteBtn = document.createElement('button');
            deleteAllEmailsForWebsiteBtn.className = 'delete-btn';
            deleteAllEmailsForWebsiteBtn.textContent = `Delete All Emails for ${lead.website}`;
            deleteAllEmailsForWebsiteBtn.addEventListener('click', (e) => {
                if (confirm(`Are you sure you want to delete all emails for ${lead.website}?`)) {
                    socket.emit('delete-all-emails-for-website', { website: lead.website });
                    e.target.classList.add('clicked');
                    setTimeout(() => e.target.classList.remove('clicked'), 200);
                }
            });
            leadDiv.appendChild(deleteAllEmailsForWebsiteBtn);

            const phoneNumbersLabel = document.createElement('strong');
            phoneNumbersLabel.textContent = 'Phone Numbers:';
            leadDiv.appendChild(phoneNumbersLabel);
            leadDiv.appendChild(document.createElement('br'));

            lead.phoneNumbers.forEach(number => {
                const phoneEntryDiv = document.createElement('div');
                phoneEntryDiv.className = 'phone-entry';

                const phoneSpan = document.createElement('span');
                phoneSpan.className = 'lead-phone';
                phoneSpan.textContent = number;
                phoneEntryDiv.appendChild(phoneSpan);

                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-number-btn';
                copyBtn.textContent = 'Copy';
                copyBtn.addEventListener('click', (e) => {
                    navigator.clipboard.writeText(number);
                    e.target.classList.add('clicked');
                    setTimeout(() => e.target.classList.remove('clicked'), 200);
                });
                phoneEntryDiv.appendChild(copyBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-number-btn';
                deleteBtn.textContent = 'Delete';
                deleteBtn.addEventListener('click', (e) => {
                    // This will require server-side logic to actually delete from leads.json
                    // For now, it will just log the action.
                    console.log(`Attempting to delete number: ${number} from website: ${lead.website}`);
                    socket.emit('delete-phone-number', { website: lead.website, number: number });
                    e.target.classList.add('clicked');
                    setTimeout(() => e.target.classList.remove('clicked'), 200);
                });
                phoneEntryDiv.appendChild(deleteBtn);

                leadDiv.appendChild(phoneEntryDiv);
            });

            // Add "Delete All Phone Numbers for this Website" button
            const deleteAllPhonesBtn = document.createElement('button');
            deleteAllPhonesBtn.className = 'delete-btn';
            deleteAllPhonesBtn.textContent = `Delete All Phones for ${lead.website}`;
            deleteAllPhonesBtn.addEventListener('click', (e) => {
                if (confirm(`Are you sure you want to delete all phone numbers for ${lead.website}?`)) {
                    socket.emit('delete-all-phones-for-website', { website: lead.website });
                    e.target.classList.add('clicked');
                    setTimeout(() => e.target.classList.remove('clicked'), 200);
                }
            });
            leadDiv.appendChild(deleteAllPhonesBtn);

            // Add "Delete All Emails for this Website" button
            const deleteAllEmailsBtn = document.createElement('button');
            deleteAllEmailsBtn.className = 'delete-btn';
            deleteAllEmailsBtn.textContent = `Delete All Emails for ${lead.website}`;
            deleteAllEmailsBtn.addEventListener('click', (e) => {
                if (confirm(`Are you sure you want to delete all emails for ${lead.website}?`)) {
                    socket.emit('delete-all-emails-for-website', { website: lead.website });
                    e.target.classList.add('clicked');
                    setTimeout(() => e.target.classList.remove('clicked'), 200);
                }
            });
            leadDiv.appendChild(deleteAllEmailsBtn);

            // Add "Delete Website" button
            const deleteWebsiteBtn = document.createElement('button');
            deleteWebsiteBtn.className = 'delete-btn';
            deleteWebsiteBtn.textContent = `Delete Website ${lead.website}`;
            deleteWebsiteBtn.addEventListener('click', (e) => {
                if (confirm(`Are you sure you want to delete the entire website ${lead.website} and all its associated data? This action cannot be undone.`)) {
                    socket.emit('delete-website', { website: lead.website });
                    e.target.classList.add('clicked');
                    setTimeout(() => e.target.classList.remove('clicked'), 200);
                }
            });
            leadDiv.appendChild(deleteWebsiteBtn);

            listContainer.appendChild(leadDiv);
        });

        const copyWebsitesBtn = document.createElement('button');
        copyWebsitesBtn.textContent = 'Copy Websites';
        copyWebsitesBtn.className = 'copy-btn';
        copyWebsitesBtn.addEventListener('click', (e) => {
            const textToCopy = industryLeads.map(l => l.website).join('\n');
            navigator.clipboard.writeText(textToCopy);
            e.target.classList.add('clicked');
            setTimeout(() => e.target.classList.remove('clicked'), 200);
        });
        listContainer.appendChild(copyWebsitesBtn);

        const copyEmailsBtn = document.createElement('button');
        copyEmailsBtn.textContent = 'Copy Emails';
        copyEmailsBtn.className = 'copy-btn';
        copyEmailsBtn.addEventListener('click', (e) => {
            const textToCopy = industryLeads.map(l => l.emails.join('\n')).join('\n');
            navigator.clipboard.writeText(textToCopy);
            e.target.classList.add('clicked');
            setTimeout(() => e.target.classList.remove('clicked'), 200);
        });
        listContainer.appendChild(copyEmailsBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', (e) => {
            const leadsToDelete = new Set(industryLeads.map(l => l.website));
            socket.emit('delete-leads', [...leadsToDelete]);
            e.target.classList.add('clicked');
            setTimeout(() => e.target.classList.remove('clicked'), 200);
        });
        listContainer.appendChild(deleteBtn);

        dataContainer.appendChild(listContainer);
    }

    const totalPages = Math.ceil(allLeads.length / leadsPerPage);
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
}

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderLeads();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(allLeads.length / leadsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderLeads();
    }
});

runScraperBtn.style.display = 'none';

copyAllWebsitesBtn.addEventListener('click', (e) => {
    const textToCopy = allLeads.map(l => l.website).join('\n');
    navigator.clipboard.writeText(textToCopy);
    e.target.classList.add('clicked');
    setTimeout(() => e.target.classList.remove('clicked'), 200);
});

copyAllEmailsBtn.addEventListener('click', (e) => {
    const textToCopy = allLeads.map(l => {
        if (l.emails) {
            return l.emails.join('\n');
        }
        return l.email || '';
    }).join('\n');
    navigator.clipboard.writeText(textToCopy);
    e.target.classList.add('clicked');
    setTimeout(() => e.target.classList.remove('clicked'), 200);
});

socket.on('initial-leads', (leads) => {
    console.log('Received initial-leads:', leads);
    mergeLeads(leads);
});

socket.on('new-lead', (lead) => {
    console.log('Received new-lead:', lead);
    if (!lead.emails) {
        lead.emails = lead.email ? [lead.email] : [];
    }
    const existingLeadIndex = allLeads.findIndex(l => l.website === lead.website);
    if (existingLeadIndex > -1) {
        allLeads[existingLeadIndex] = { ...allLeads[existingLeadIndex], ...lead };
    } else {
        allLeads.unshift(lead);
    }
    // Sort leads by scrapedAt in descending order (most recent first)
    allLeads.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
    localStorage.setItem('allLeads', JSON.stringify(allLeads));
    renderLeads();
});




socket.on('scraper-running', () => {
    runScraperBtn.disabled = true;
    runScraperBtn.textContent = 'Scraper is running...';
});

socket.on('scraper-done', () => {
    runScraperBtn.disabled = false;
    runScraperBtn.textContent = 'Run Scraper';
});

socket.on('leads-updated', (leads) => {
    console.log('Received leads-updated:', leads);
    mergeLeads(leads);
});

// Add client-side Socket.io error handling
socket.on('disconnect', (reason) => {
    console.error('Socket disconnected:', reason);
    // You might want to display a message to the user or attempt to reconnect
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    // You might want to display an error message to the user
});

// Periodically request latest leads from the server every 7 minutes (420000 ms)
setInterval(() => {
    console.log('Requesting latest leads from server...');
    socket.emit('request-latest-leads');
}, 180000); // 7 minutes * 60 seconds/minute * 1000 ms/second