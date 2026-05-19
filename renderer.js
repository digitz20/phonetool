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
            leadDiv.innerHTML = `<span class="lead-website">${lead.website}</span><br><span class="lead-email">${lead.emails.join(', ')}</span>`;
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
    renderLeads();
});

socket.on('new-lead', (lead) => {
    console.log('Received new-lead:', lead);
    if (!lead.emails) {
        lead.emails = lead.email ? [lead.email] : [];
    }
    allLeads.unshift(lead);
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