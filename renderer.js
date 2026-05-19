const socket = io();
console.log('Socket.io client initialized.');

const runScraperBtn = document.getElementById('run-scraper-btn');
const copyAllWebsitesBtn = document.getElementById('copy-all-websites-btn');
const copyAllEmailsBtn = document.getElementById('copy-all-emails-btn');
const dataContainer = document.getElementById('data-container');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');

let allLeads = [];
let currentPage = 1;
const leadsPerPage = 10;

// Load leads from localStorage on startup
const storedLeads = localStorage.getItem('allLeads');
if (storedLeads) {
    allLeads = JSON.parse(storedLeads);
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

            const websiteSpan = document.createElement('span');
            websiteSpan.className = 'lead-website';
            websiteSpan.textContent = lead.website;
            leadDiv.appendChild(websiteSpan);
            leadDiv.appendChild(document.createElement('br'));

            const emailsLabel = document.createElement('strong');
            emailsLabel.textContent = 'Emails:';
            leadDiv.appendChild(emailsLabel);
            leadDiv.appendChild(document.createElement('br'));

            lead.emails.forEach(email => {
                const emailSpan = document.createElement('span');
                emailSpan.className = 'lead-email';
                emailSpan.textContent = email;
                leadDiv.appendChild(emailSpan);
                leadDiv.appendChild(document.createElement('br'));
            });

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
    allLeads = leads;
    localStorage.setItem('allLeads', JSON.stringify(allLeads));
    renderLeads();
});

socket.on('new-lead', (lead) => {
    console.log('Received new-lead:', lead);
    if (!lead.emails) {
        lead.emails = lead.email ? [lead.email] : [];
    }
    allLeads.unshift(lead);
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
    allLeads = leads;
    renderLeads();
});