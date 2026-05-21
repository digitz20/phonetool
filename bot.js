


require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const { parsePhoneNumberFromString } = require('libphonenumber-js');


// Global state for staggered search
let currentIndustryIndex = 0;
let currentCountryCodeIndex = 0;
const COUNTRY_CODE_BATCH_SIZE = 3;
const DELAY_BETWEEN_BATCHES_MS = 60 * 1000; // 1 minute delay between batches





// Function to load leads from leads.json
function loadLeads() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'leads.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading leads.json:', error);
    return [];
  }
}

// Function to save leads to leads.json
function saveLeads(leads) {
  try {
    fs.writeFileSync(path.join(__dirname, 'leads.json'), JSON.stringify(leads, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving leads.json:', error);
  }
}

// Helper function to format email local part as a name
function formatEmailLocalPartAsName(email) {
  if (!email || typeof email !== 'string') {
    return 'Our Team';
  }

  const localPart = email.split('@')[0];

  // If the local part contains numbers, it's unlikely to be a real name
  if (/\d/.test(localPart)) {
    return 'Our Team';
  }

  // List of generic local parts that should not be used as a sender name
  // Check if the local part is a generic name
  if (CONFIG.genericNames.includes(localPart.toLowerCase())) {
    return 'Our Team';
  }

  // Replace common separators with spaces and split into words
  const words = localPart.replace(/[._-]/g, ' ').split(' ');

  // Capitalize each word and join them
  const formattedName = words.map(word => {
    if (word.length === 0) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');

  // If after formatting, the name is empty or still looks generic (e.g., just initials),
  // or if it's a single letter, fall back to 'Our Team'
  if (!formattedName.trim() || formattedName.length <= 2) {
    return 'Our Team';
  }

  return formattedName;
}

/**
 * Selects the best sender name for a lead based on available information.
 * Prioritizes scraped person's name, then non-generic email local parts,
 * then company name, finally defaulting to 'Our Team'.
 * @param {object} lead - The lead object containing emails, companyName, and sender info.
 * @returns {string} The selected sender name.
 */
function selectBestSenderName(lead) {
  // 1. Prioritize scraped person's name if available
  if (lead && lead.sender && lead.sender.first_name && lead.sender.last_name) {
    const scrapedName = `${lead.sender.first_name} ${lead.sender.last_name}`.trim();
    // If a scraped name exists and is not empty, use it directly
    if (scrapedName.length > 0) {
      return scrapedName;
    }
  }

  // 2. Look for a non-generic name from email local parts
  let bestEmailName = '';
  if (lead && lead.emails && lead.emails.length > 0) {
    for (const email of lead.emails) {
      const derivedName = formatEmailLocalPartAsName(email);
      if (derivedName !== 'Our Team') {
        // Found a non-generic name, use it
        bestEmailName = derivedName;
        break; // Take the first good one
      }
    }
  }

  if (bestEmailName) {
    return bestEmailName;
  }

  // 3. Fallback to company name if available and not too generic
  if (lead && lead.companyName) {
    const companyName = lead.companyName.trim();
    // Check if company name is not just a generic term or too short
    if (companyName.length > 2 && !CONFIG.genericNames.includes(companyName.toLowerCase())) {
      return companyName;
    }
  }

  // 4. Default to 'Our Team'
  return 'Our Team';
}

// Function to get multiple random country codes from the CONFIG.countryCodes object
function getMultipleRandomCountryCodes(count = 1) {
  const countryCodes = Object.keys(CONFIG.countryCodes);
  if (countryCodes.length === 0) {
    return []; // No country codes available
  }

  const shuffled = countryCodes.sort(() => 0.5 - Math.random());
 return shuffled.slice(0, Math.min(count, countryCodes.length));
}

// ---------- CONFIG ----------
const CONFIG = {
  manualCountryCodesForSearch: ['CN', 'GB', 'QA', 'DE', 'RU', 'VN', 'TR', 'IT', 'FR',
     'JP', 'US', 'CA', 'AE', 'ID', 'TH', 'KR', 'AU', 'SG', 'HK', 'AT', 'BR'], // Manually set country codes for search
  genericNames: [
    'info', 'sales', 'support', 'admin', 'administrator', 'noreply', 'no-reply', 'Email Member',
    'contact', '', 'help', 'enquiries', 'enquiry', 'marketing', 'pr',
    'press', 'billing', 'accounts', 'finance', 'hr', 'jobs', 'careers', 'team',
    'hello', 'office', 'customerservice', 'feedback', 'abuse', 'security',
    'privacy', 'legal', 'postmaster', 'hostmaster', 'usenet', 'news', 'web',
    'dev', 'development', 'test', 'testing', 'noreply', 'noresponse', 'auto',
    'automated', 'system', 'daemon', 'mailer-daemon', 'undisclosed-recipients',
    'everyone', 'all', 'group', 'list', 'subscribe', 'unsubscribe', 'newsletter',
    'digest', 'forum', 'community', 'notifications', 'alert', 'alerts', 'report',
    'reports', 'status', 'update', 'updates', 'service', 'services', 'client',
    'clients', 'customer', 'customers', 'guest', 'guests', 'user', 'users',
    'member', 'members', 'partner', 'partners', 'affiliate', 'affiliates',
    'investor', 'investors', 'media', 'relations', 'public', 'relations',
    'management', 'executive', 'ceo', 'cfo', 'cto', 'coo', 'cmo', 'cio', 'cso',
    'president', 'director', 'manager', 'supervisor', 'coordinator', 'assistant',
    'reception', 'receptionist', 'frontdesk', 'booking', 'reservations', 'orders',
    'returns', 'shipping', 'delivery', 'dispatch', 'warehouse', 'inventory',
    'purchasing', 'procurement', 'vendor', 'vendors', 'supplier', 'suppliers',
    'donations', 'donate', 'fundraising', 'volunteer', 'volunteers', 'events',
    'event', 'webinar', 'webinars', 'seminar', 'seminars', 'training', 'education',
    'academy', 'institute', 'research', 'development', 'rnd', 'innovation',
    'solutions', 'consulting', 'consultant', 'advisory', 'advisor', 'expert',
    'experts', 'specialist', 'specialists', 'engineer', 'engineers', 'developer',
    'developers', 'programmer', 'programmers', 'designer', 'designers', 'artist',
    'artists', 'creative', 'editor', 'editors', 'writer', 'writers', 'author',
    'authors', 'publisher', 'publishers', 'moderator', 'moderators', 'adminteam',
    'supportteam', 'helpdesk', 'techsupport', 'webcontact', 'clientservices',
    'accountmanager', 'accounting', 'legal', 'privacy', 'terms', 'pressoffice',
    'mediarelations', 'team', 'it', 'tech', 'techteam', 'it-support',
    'it-helpdesk', 'it-admin', 'itadmin', 'itsupport', 'ithelpdesk', 'itmanager',
    'it-manager', 'webteam', 'web-team', 'webadmin', 'web-admin', 'webdeveloper',
    'web-developer', 'webdesigner', 'web-designer', 'team', '-team',
    'admin', '-admin', 'help', 'help',
    'info', 'info', 'contact', 'contact',
    'feedback', 'feedback', 'inquiry', 'inquiry',
    'support', 'support', 'general', 'general',
    'public', 'public', 'media', 'media',
    'press', 'press', 'marketing', 'marketing',
    'sales', 'sales', 'hr', 'hr',
    'jobs', 'jobs', 'careers', 'careers',
    'billing', 'billing', 'accounts', 'accounts',
    'finance', 'finance', 'legal', 'legal',
    'privacy', 'privacy', 'terms', 'terms',
    'security', 'security', 'abuse', 'abuse',
    'feedback', 'feedback', 'hello', 'hello',
    'office', 'office', 'customerservice', 'customerservice',
    'feedback', 'feedback', 'abuse', 'abuse',
    'security', 'security', 'privacy', 'privacy',
    'legal', 'legal', 'postmaster', 'postmaster',
    'hostmaster', 'hostmaster', 'usenet', 'usenet',
    'news', 'news', 'web', 'web',
    'dev', 'dev', 'development', 'development',
    'test', 'test', 'testing', 'testing',
    'noreply', 'noreply', 'noresponse', 'noresponse',
    'auto', 'auto', 'automated', 'automated',
    'system', 'system', 'daemon', 'daemon',
    'mailer-daemon', 'mailer-daemon', 'undisclosed-recipients',
    'undisclosed-recipients', 'everyone', 'everyone',
    'all', 'all', 'group', 'group',
    'list', 'list', 'subscribe', 'subscribe',
    'unsubscribe', 'unsubscribe', 'newsletter', 'newsletter',
    'digest', 'digest', 'forum', 'forum',
    'community', 'community', 'notifications', 'notifications',
    'alert', 'alert', 'alerts', 'alerts',
    'report', 'report', 'reports', 'reports',
    'status', 'status', 'update', 'update',
    'updates', 'updates', 'service', 'service',
    'services', 'services', 'client', 'client',
    'clients', 'clients', 'customer', 'customer',
    'customers', 'customers', 'guest', 'guest',
    'guests', 'guests', 'user', 'user',
    'users', 'users', 'member', 'member',
    'members', 'members', 'partner', 'partner',
    'partners', 'partners', 'affiliate', 'affiliate',
    'affiliates', 'affiliates', 'investor', 'investor',
    'investors', 'investors', 'media', 'media',
    'relations', 'relations', 'public', 'public',
    'management', 'management', 'executive', 'executive',
    'ceo', 'ceo', 'cfo', 'cfo',
    'cto', 'cto', 'coo', 'coo',
    'cmo', 'cmo', 'cio', 'cio',
    'cso', 'cso', 'president', 'president',
    'director', 'director', 'manager', 'manager',
    'supervisor', 'supervisor', 'coordinator', 'coordinator',
    'assistant', 'assistant', 'reception', 'reception',
    'receptionist', 'receptionist', 'frontdesk', 'frontdesk',
    'booking', 'booking', 'reservations', 'reservations',
    'orders', 'orders', 'returns', 'returns',
    'shipping', 'shipping', 'delivery', 'delivery',
    'dispatch', 'dispatch', 'warehouse', 'warehouse',
    'inventory', 'inventory', 'purchasing', 'purchasing',
    'procurement', 'procurement', 'vendor', 'vendor',
    'vendors', 'vendors', 'supplier', 'supplier',
    'suppliers', 'suppliers', 'donations', 'donations',
    'donate', 'donate', 'fundraising', 'fundraising',
    'volunteer', 'volunteer', 'volunteers', 'volunteers',
    'events', 'events', 'event', 'event',
    'webinar', 'webinar', 'webinars', 'webinars',
    'seminar', 'seminar', 'seminars', 'seminars',
    'training', 'training', 'education', 'education',
    'academy', 'academy', 'institute', 'institute',
    'research', 'research', 'development', 'development',
    'rnd', 'rnd', 'innovation', 'innovation',
    'solutions', 'solutions', 'consulting', 'consulting',
    'consultant', 'consultant', 'advisory', 'advisory',
    'advisor', 'advisor', 'expert', 'expert',
    'experts', 'experts', 'specialist', 'specialist',
    'specialists', 'specialists', 'engineer', 'engineer',
    'engineers', 'engineers', 'developer', 'developer',
    'developers', 'developers', 'programmer', 'programmer',
    'programmers', 'programmers', 'designer', 'designer',
    'designers', 'designers', 'artist', 'artist',
    'artists', 'artists', 'creative', 'creative',
    'editor', 'editor', 'editors', 'editors',
    'writer', 'writer', 'writers', 'writers',
    'author', '-author', 'authors', '-authors',
    'publisher', '-publisher', 'publishers', '-publishers',
    'moderator', '-moderator', 'moderators', '-moderators',
    'undisclosed', 'recipient', 'recipients', 'anonymous', 'placeholder', 'dummy', 'testaccount',
    'invalid', 'spam', 'junk', 'abuse', 'security', 'noreply', 'no-reply', 'postmaster',
    'hostmaster', 'mailer-daemon', 'daemon', 'autoresponder', 'automated', 'system', 'robot',
    'bot', 'admin', 'administrator', 'support', 'info', 'contact', 'enquiry', 'sales',
    'marketing', 'press', 'media', 'billing', 'accounts', 'finance', 'hr', 'jobs',
    'careers', '', 'helpdesk', 'it', 'tech', 'office', 'hello', 'feedback',
    'privacy', 'legal', 'compliance', 'operations', 'management', 'team', 'group',
    'publicrelations', 'investorrelations', 'customerservice', 'clientservices', 'guestservices',
    'useraccount', 'myaccount', 'youraccount', 'account', 'service', 'services', 'alert',
    'alerts', 'notification', 'notifications', 'update', 'updates', 'report', 'reports',
    'status', 'newsletter', 'subscribe', 'unsubscribe', 'forum', 'community', 'events',
    'webinar', 'seminar', 'training', 'education', 'research', 'development', 'innovation',
    'solutions', 'consulting', 'advisory', 'expert', 'specialist', 'engineer', 'developer',
    'programmer', 'designer', 'artist', 'creative', 'editor', 'writer', 'author',
    'publisher', 'moderator', 'supervisor', 'coordinator', 'assistant', 'reception',
    'frontdesk', 'booking', 'reservations', 'orders', 'returns', 'shipping', 'delivery',
    'dispatch', 'warehouse', 'inventory', 'purchasing', 'procurement', 'vendor', 'supplier',
    'donations', 'fundraising', 'volunteer', 'academy', 'institute', 'rnd', 'ceo', 'cfo',
    'cto', 'coo', 'cmo', 'cio', 'cso', 'president', 'director', 'manager', 'executive',
    'team', 'it-support', 'it-helpdesk', 'it-admin', 'webteam', 'web-admin',
    'webdeveloper', 'webdesigner', 'team', 'admin', 'help',
    'info', 'contact', 'feedback', 'inquiry',
    'support', 'general', 'public', 'media',
    'press', 'marketing', 'sales', 'hr',
    'jobs', 'careers', 'billing', 'accounts',
    'finance', 'legal', 'privacy', 'terms',
    'security', 'abuse', 'hello', 'office',
    'customerservice', 'postmaster', 'hostmaster',
    'usenet', 'news', 'web', 'dev',
    'development', 'test', 'testing', 'noreply',
    'noresponse', 'auto', 'automated', 'system',
    'daemon', 'mailer-daemon', 'undisclosed-recipients',
    'everyone', 'all', 'group', 'list',
    'subscribe', 'unsubscribe', 'newsletter',
    'digest', 'forum', 'community', 'notifications',
    'alert', 'alerts', 'report', 'reports',
    'status', 'update', 'updates', 'service',
    'services', 'client', 'clients', 'customer',
    'customers', 'guest', 'guests', 'user',
    'users', 'member', 'members', 'partner',
    'partners', 'affiliate', 'affiliates',
    'investor', 'investors', 'media', 'relations',
    'public', 'management', 'executive', 'ceo',
    'cfo', 'cto', 'coo', 'cmo',
    'cio', 'cso', 'president', 'director',
    'manager', 'supervisor', 'coordinator',
    'assistant', 'reception', 'receptionist',
    'frontdesk', 'booking', 'reservations',
    'orders', 'returns', 'shipping',
    'delivery', 'dispatch', 'warehouse',
    'inventory', 'purchasing', 'procurement',
    'vendor', 'vendors', 'supplier',
    'suppliers', 'donations', 'donate',
    'fundraising', 'volunteer', 'volunteers',
    'events', 'event', 'webinar',
    'webinars', 'seminar', 'seminars',
    'training', 'education', 'academy',
    'institute', 'research', 'development',
    'rnd', 'innovation', 'solutions',
    'consulting', 'consultant', 'advisory',
    'advisor', 'expert', 'experts',
    'specialist', 'specialists', 'engineer',
    'engineers', 'developer', 'developers',
    'programmer', 'programmers', 'designer',
    'designers', 'artist', 'artists',
    'creative', 'editor', 'editors',
    'writer', 'writers', 'author',
    'authors', 'publisher', 'publishers',
    'moderator', 'moderators'
  ],
  industries: [
    'Agriculture', 'Apparel', 'Banking', 'Biotechnology', 'Chemical', 'Communications', 'Construction',
    'Consulting', 'Education', 'Electronics', 'Energy', 'Engineering', 'Entertainment', 'Environmental',
    'Finance', 'Food & Beverage', 'Government', 'Healthcare', 'Hospitality', 'Insurance', 'Machinery',
    'Manufacturing', 'Media', 'Not For Profit', 'Other', 'Pharmaceuticals', 'Recreation', 'Retail',
    'Shipping', 'Technology', 'Telecommunications', 'Transportation', 'Utilities', 'Wholesale',
    'Automotive', 'Aerospace', 'Plastics', 'Metallurgy', 'Pulp and Paper', 'Furniture', 'Footwear',
    'Ceramics', 'Glass', 'Industrial Machinery', 'Electrical Equipment', 'Medical Devices', 'Renewable Energy',
    'Accounting', 'Airlines/Aviation', 'Alternative Dispute Resolution', 'Alternative Medicine', 'Animation',
    'Architecture & Planning', 'Arts and Crafts', 'Automotive', 'Aviation & Aerospace', 'Broadcast Media',
    'Building Materials', 'Business Supplies and Equipment', 'Capital Markets', 'Civic & Social Organization',
    'Civil Engineering', 'Commercial Real Estate', 'Computer & Network Security', 'Computer Games',
    'Computer Hardware', 'Computer Networking', 'Computer Software', 'Consumer Electronics', 'Consumer Goods',
    'Consumer Services', 'Cosmetics', 'Dairy', 'Defense & Space', 'Design', 'E-Learning', 'Electrical/Electronic Manufacturing',
    'Events Services', 'Executive Office', 'Facilities Services', 'Farming', 'Financial Services', 'Fine Art',
    'Fishery', 'Food Production', 'Fund-Raising', 'Gambling & Casinos', 'Government Administration',
    'Government Relations', 'Graphic Design', 'Health, Wellness and Fitness', 'Higher Education', 'Human Resources',
    'Import and Export', 'Individual & Family Services', 'Industrial Automation', 'Information Services',
    'Information Technology and Services', 'International Affairs', 'International Trade and Development',
    'Investment Banking', 'Investment Management', 'Judiciary', 'Law Enforcement', 'Law Practice', 'Legal Services',
    'Legislative Office', 'Leisure, Travel & Tourism', 'Libraries', 'Logistics and Supply Chain', 'Luxury Goods & Jewelry',
    'Management Consulting', 'Maritime', 'Market Research', 'Marketing and Advertising', 'Mechanical or Industrial Engineering',
    'Media Production', 'Medical Practice', 'Mental Health Care', 'Military', 'Mining & Metals', 'Motion Pictures and Film',
    'Museums and Institutions', 'Music', 'Nanotechnology', 'Newspapers', 'Non-Profit Organization Management',
    'Oil & Energy', 'Online Media', 'Outsourcing/Offshoring', 'Package/Freight Delivery', 'Packaging and Containers',
    'Paper & Forest Products', 'Performing Arts', 'Philanthropy', 'Photography', 'Plastics', 'Political Organization',
    'Primary/Secondary Education', 'Printing', 'Professional Training & Coaching', 'Program Development',
    'Public Policy', 'Public Relations and Communications', 'Public Safety', 'Publishing', 'Railroad Manufacture',
    'Ranching', 'Real Estate', 'Religious Institutions', 'Research', 'Restaurants', 'Security and Investigations',
    'Semiconductors', 'Shipbuilding', 'Sporting Goods', 'Sports', 'Staffing and Recruiting', 'Supermarkets',
    'Telecommunications', 'Textiles', 'Think Tanks', 'Tobacco', 'Translation and Localization', 'Venture Capital & Private Equity',
    'Veterinary', 'Warehousing', 'Wholesale', 'Wine and Spirits', 'Wireless', 'Writing and Editing',
    'Food Processing', 'Textile', 'Wood', 'Printing', 'Refined Petroleum', 'Rubber', 'Non-Metallic Mineral', 'Basic Metals', 'Fabricated Metal', 'Computer and Electronic',
    'Electrical', 'Transportation Equipment', 'Furniture Manufacturing', 'Toy', 'Sporting Goods Manufacturing',
    'Advertising', 'Aerospace', 'Automotive', 'Biotechnology', 'Chemicals',
    'Consumer Goods', 'Defense', 'E-commerce', 'Fashion', 'Financial Services',
    'Food Production', 'Forestry', 'Gambling', 'Gemstone', 'Health & Wellness',
    'Home Furnishings', 'Human Resources', 'Information Technology', 'Investment Banking',
    'Journalism', 'Leisure', 'Logistics', 'Machinery', 'Management Consulting',
    'Marketing', 'Medical Devices', 'Music', 'Nanotechnology', 'Oil & Gas',
    'Packaging', 'Paper', 'Plastics', 'Publishing', 'Renewable Energy',
    'Robotics', 'Security', 'Semiconductors', 'Shipping', 'Sports',
    'Textiles', 'Tourism', 'Venture Capital', 'Waste Management', 'Water Treatment',
    'Agriculture', 'Automotive', 'Banking', 'Biotechnology', 'Chemicals',
    'Construction', 'Consulting', 'Education', 'Energy', 'Engineering',
    'Entertainment', 'Environmental Services', 'Fashion', 'Food & Beverage',
    'Government', 'Healthcare', 'Hospitality', 'Insurance', 'Legal Services',
    'Manufacturing', 'Media', 'Non-profit', 'Pharmaceuticals', 'Real Estate',
    'Retail', 'Technology', 'Telecommunications', 'Transportation', 'Utilities',
    'Cybersecurity', 'Fintech', 'Biotechnology', 'Renewable Energy', 'Logistics',
    'E-commerce', 'Digital Marketing', 'Artificial Intelligence', 'Virtual Reality', 'Augmented Reality',
    'Aerospace & Defense', 'Automotive', 'Construction & Engineering', 'Education Management',
    'Environmental Services', 'Government Administration', 'Human Resources', 'Investment Banking',
    'Legal Services', 'Marketing & Advertising', 'Media & Entertainment', 'Non-profit Organization Management',
    'Oil & Gas', 'Pharmaceuticals', 'Real Estate', 'Sports & Recreation', 'Telecommunications',
    'Transportation & Logistics', 'Utilities', 'Wholesale Trade',
    'Agriculture & Farming', 'Arts & Culture', 'Banking & Finance', 'Biotechnology & Life Sciences',
    'Chemical Manufacturing', 'Civil Engineering', 'Consulting Services', 'Consumer Goods',
    'Data Analytics', 'E-learning', 'Fashion & Apparel', 'Food & Beverage Production',
    'Healthcare Services', 'Hospitality & Tourism', 'Information Technology', 'Insurance Services',
    'Manufacturing & Production', 'Mining & Metals', 'Non-profit & Philanthropy',
    'Public Relations', 'Publishing & Editing', 'Research & Development', 'Retail Trade',
    'Software Development', 'Supply Chain Management', 'Transportation Services',
    'Waste Management', 'Water Treatment'
  ],
  
  googleResultsPerSearch: 200,
  maxPagesToVisit: 200,
  maxEmailsPerDomain: 200, // Maximum number of unique emails to collect per domain
  maxPeopleToScrape: 40, // Maximum number of people (names, titles, emails) to scrape per website
  peoplePageConcurrency: 5, // Number of people pages to scrape concurrently




  defaultCountryCode: null, // Set to a country code like 'US', 'GB', etc., to filter searches by country. Set to null for global search.
  defaultDialingCode: null, // Set to a dialing code like '+1', '+44', etc., to filter searches by dialing code. Set to null for no dialing code filter.
  searchTlds: [
    '.com', '.org', '.net', '.io', '.co', '.ad', '.ae', '.af', '.ag', '.al',
    '.am', '.ao', '.ar', '.at', '.au', '.az', '.ba', '.bb', '.bd', '.be',
    '.bf', '.bg', '.bh', '.bi', '.bj', '.bn', '.bo', '.br', '.bs', '.bt',
    '.bw', '.by', '.bz', '.ca', '.cd', '.cf', '.cg', '.ch', '.ci', '.ck',
    '.cl', '.cm', '.cn', '.co', '.cr', '.cu', '.cv', '.cy', '.cz', '.de',
    '.dj', '.dk', '.dm', '.do', '.dz', '.ec', '.ee', '.eg', '.er', '.es',
    '.et', '.eu', '.fi', '.fj', '.fm', '.fr', '.ga', '.gb', '.gd', '.ge',
    '.gh', '.gm', '.gn', '.gq', '.gr', '.gt', '.gw', '.gy', '.hk', '.hn',
    '.hr', '.ht', '.hu', '.id', '.ie', '.il', '.in', '.iq', '.ir', '.is',
    '.it', '.jm', '.jo', '.jp', '.ke', '.kg', '.kh', '.ki', '.km', '.kn',
    '.kp', '.kr', '.kw', '.kz', '.la', '.lb', '.lc', '.li', '.lk', '.lr',
    '.ls', '.lt', '.lu', '.lv', '.ly', '.ma', '.mc', '.md', '.me', '.mg',
    '.mh', '.mk', '.ml', '.mm', '.mn', '.mo', '.mr', '.mt', '.mu', '.mv',
    '.mw', '.mx', '.my', '.mz', '.na', '.ne', '.ng', '.ni', '.nl', '.no',
    '.np', '.nr', '.nz', '.om', '.pa', '.pe', '.pg', '.ph', '.pk', '.pl',
    '.pt', '.pw', '.py', '.qa', '.ro', '.rs', '.ru', '.rw', '.sa', '.sb',
    '.sc', '.sd', '.se', '.sg', '.si', '.sk', '.sl', '.sm', '.sn', '.so',
    '.sr', '.st', '.sv', '.sy', '.sz', '.td', '.tg', '.th', '.tj', '.tl',
    '.tm', '.tn', '.to', '.tr', 'tt', '.tv', '.tz', '.ua', '.ug', '.us',
    '.uy', '.uz', '.va', '.vc', '.ve', '.vn', '.vu', '.ws', '.ye', '.za',
    '.zm', '.zw'
  ],
  countryCodes: {
    'US': 'United States', 'CA': 'Canada', 'GB': 'United Kingdom', 'AU': 'Australia', 'DE': 'Germany',
    'FR': 'France', 'JP': 'Japan', 'IN': 'India', 'BR': 'Brazil', 'CN': 'China',
    'ES': 'Spain', 'IT': 'Italy', 'NL': 'Netherlands', 'SE': 'Sweden', 'CH': 'Switzerland',
    'MX': 'Mexico', 'SG': 'Singapore', 'NZ': 'New Zealand', 'IE': 'Ireland', 'ZA': 'South Africa',
    'AE': 'United Arab Emirates', 'AR': 'Argentina', 'AT': 'Austria', 'BE': 'Belgium', 'CL': 'Chile',
    'CO': 'Colombia', 'DK': 'Denmark', 'FI': 'Finland', 'GR': 'Greece', 'HK': 'Hong Kong',
    'ID': 'Indonesia', 'IL': 'Israel', 'KR': 'South Korea', 'MY': 'Malaysia', 'NO': 'Norway',
    'PH': 'Philippines', 'PL': 'Poland', 'PT': 'Portugal', 'RU': 'Russia', 'SA': 'Saudi Arabia',
    'TH': 'Thailand', 'TR': 'Turkey', 'TW': 'Taiwan', 'VN': 'Vietnam',
    'NG': 'Nigeria', 'GH': 'Ghana', 'KE': 'Kenya',
    'EG': 'Egypt', 'PK': 'Pakistan', 'BD': 'Bangladesh', 'PE': 'Peru', 'VE': 'Venezuela',
    'UA': 'Ukraine', 'CZ': 'Czech Republic', 'HU': 'Hungary', 'RO': 'Romania', 'BG': 'Bulgaria',
    'HR': 'Croatia', 'RS': 'Serbia', 'SK': 'Slovakia', 'SI': 'Slovenia', 'LT': 'Lithuania',
    'LV': 'Latvia', 'EE': 'Estonia', 'MA': 'Morocco', 'DZ': 'Algeria', 'TN': 'Tunisia',
    'ET': 'Ethiopia', 'TZ': 'Tanzania', 'UG': 'Uganda', 'KZ': 'Kazakhstan', 'UZ': 'Uzbekistan',
    'MN': 'Mongolia', 'LK': 'Sri Lanka', 'NP': 'Nepal', 'FJ': 'Fiji', 'PG': 'Papua New Guinea',
      'AF': 'Afghanistan', 'AL': 'Albania', 'AD': 'Andorra', 'AO': 'Angola',
  'AM': 'Armenia', 'AZ': 'Azerbaijan', 'BH': 'Bahrain', 'BY': 'Belarus',
  'BZ': 'Belize', 'BJ': 'Benin', 'BT': 'Bhutan', 'BA': 'Bosnia and Herzegovina',
  'BW': 'Botswana', 'BN': 'Brunei', 'BF': 'Burkina Faso', 'BI': 'Burundi',
  'KH': 'Cambodia', 'CM': 'Cameroon', 'CV': 'Cape Verde',
  'CF': 'Central African Republic', 'TD': 'Chad', 'KM': 'Comoros',
  'CG': 'Congo (Brazzaville)', 'CD': 'Congo (Kinshasa)', 'CR': 'Costa Rica',
  'CI': "Cote d'Ivoire", 'CU': 'Cuba', 'CY': 'Cyprus',
  'DJ': 'Djibouti', 'DM': 'Dominica', 'DO': 'Dominican Republic',
  'EC': 'Ecuador', 'SV': 'El Salvador', 'GQ': 'Equatorial Guinea',
  'ER': 'Eritrea', 'SZ': 'Eswatini', 'GA': 'Gabon',
  'GM': 'Gambia', 'GE': 'Georgia', 'GD': 'Grenada',
  'GT': 'Guatemala', 'GN': 'Guinea', 'GW': 'Guinea-Bissau',
  'GY': 'Guyana', 'HT': 'Haiti', 'HN': 'Honduras',
  'IS': 'Iceland', 'IQ': 'Iraq', 'IR': 'Iran',
  'JM': 'Jamaica', 'JO': 'Jordan', 'KG': 'Kyrgyzstan',
  'LA': 'Laos', 'LB': 'Lebanon', 'LS': 'Lesotho',
  'LR': 'Liberia', 'LY': 'Libya', 'LI': 'Liechtenstein',
  'LU': 'Luxembourg', 'MG': 'Madagascar', 'MW': 'Malawi',
  'MV': 'Maldives', 'ML': 'Mali', 'MT': 'Malta',
  'MH': 'Marshall Islands', 'MR': 'Mauritania', 'MU': 'Mauritius',
  'FM': 'Micronesia', 'MD': 'Moldova', 'MC': 'Monaco',
  'ME': 'Montenegro', 'MZ': 'Mozambique', 'MM': 'Myanmar',
  'NA': 'Namibia', 'NR': 'Nauru', 'NI': 'Nicaragua',
  'NE': 'Niger', 'MK': 'North Macedonia', 'OM': 'Oman',
  'PW': 'Palau', 'PA': 'Panama', 'PY': 'Paraguay',
  'QA': 'Qatar', 'RW': 'Rwanda', 'KN': 'Saint Kitts and Nevis',
  'LC': 'Saint Lucia', 'VC': 'Saint Vincent and the Grenadines',
  'WS': 'Samoa', 'SM': 'San Marino', 'ST': 'Sao Tome and Principe',
  'SN': 'Senegal', 'SC': 'Seychelles', 'SL': 'Sierra Leone',
  'SB': 'Solomon Islands', 'SO': 'Somalia', 'SS': 'South Sudan',
  'LK': 'Sri Lanka', 'SD': 'Sudan', 'SR': 'Suriname',
  'SY': 'Syria', 'TJ': 'Tajikistan', 'TL': 'Timor-Leste',
  'TG': 'Togo', 'TO': 'Tonga', 'TT': 'Trinidad and Tobago',
  'TM': 'Turkmenistan', 'TV': 'Tuvalu', 'UY': 'Uruguay',
  'VU': 'Vanuatu', 'VA': 'Vatican City', 'YE': 'Yemen',
  'ZM': 'Zambia', 'ZW': 'Zimbabwe'
  },
  countryTldMapping: {
    'US': ['.com', '.org', '.net', '.us', '.info', '.biz', '.name'],
    'CA': ['.ca', '.com', '.org', '.net'],
    'GB': ['.co.uk', '.org.uk', '.uk', '.com', '.info', '.biz', '.name'],
    'AU': ['.com.au', '.net.au', '.org.au', '.au'],
    'DE': ['.de', '.com', '.org', '.net', '.info', '.biz', '.name'],
    'FR': ['.fr', '.com', '.org', '.net'],
    'JP': ['.jp', '.co.jp', '.or.jp', '.ne.jp', '.com'],
    'IN': ['.in', '.co.in', '.org.in', '.net.in', '.com'],
    'BR': ['.br', '.com.br', '.org.br', '.net.br', '.com'],
    'CN': ['.cn', '.com.cn', '.org.cn', '.net.cn', '.com'],
    'ES': ['.es', '.com', '.org', '.net'],
    'IT': ['.it', '.com', '.org', '.net'],
    'NL': ['.nl', '.com', '.org', '.net'],
    'SE': ['.se', '.com', '.org', '.net'],
    'CH': ['.ch', '.com', '.org', '.net'],
    'MX': ['.mx', '.com.mx', '.org.mx', '.net.mx', '.com'],
    'SG': ['.sg', '.com.sg', '.org.sg', '.net.sg', '.com'],
    'NZ': ['.nz', '.co.nz', '.org.nz', '.net.nz', '.com'],
    'IE': ['.ie', '.com', '.org', '.net'],
    'ZA': ['.co.za', '.org.za', '.net.za', '.za', '.com'],
    'AE': ['.ae', '.com', '.org', '.net'],
    'AR': ['.ar', '.com.ar', '.org.ar', '.net.ar', '.com'],
    'AT': ['.at', '.com', '.org', '.net'],
    'BE': ['.be', '.com', '.org', '.net'],
    'CL': ['.cl', '.com.cl', '.org.cl', '.net.cl', '.com'],
    'CO': ['.co', '.com.co', '.org.co', '.net.co'],
    'DK': ['.dk', '.com', '.org', '.net'],
    'FI': ['.fi', '.com', '.org', '.net'],
    'GR': ['.gr', '.com.gr', '.org.gr', '.net.gr', '.com'],
    'HK': ['.hk', '.com.hk', '.org.hk', '.net.hk', '.com'],
    'ID': ['.id', '.co.id', '.or.id', '.net.id', '.com'],
    'IL': ['.il', '.co.il', '.org.il', '.net.il', '.com'],
    'KR': ['.kr', '.co.kr', '.or.kr', '.ne.kr', '.com'],
    'MY': ['.my', '.com.my', '.org.my', '.net.my', '.com'],
    'NO': ['.no', '.com', '.org', '.net'],
    'PH': ['.ph', '.com.ph', '.org.ph', '.net.ph', '.com'],
    'PL': ['.pl', '.com.pl', '.org.pl', '.net.pl', '.com'],
    'PT': ['.pt', '.com.pt', '.org.pt', '.net.pt', '.com'],
    'RU': ['.ru', '.com', '.org', '.net'],
    'SA': ['.sa', '.com.sa', '.org.sa', '.net.sa', '.com'],
    'TH': ['.th', '.co.th', '.or.th', '.net.th', '.com'],
    'TR': ['.tr', '.com.tr', '.org.tr', '.net.tr', '.com'],
    'TW': ['.tw', '.com.tw', '.org.tw', '.net.tw', '.com'],
    'VN': ['.vn', '.com.vn', '.org.vn', '.net.vn', '.com'],
    'NG': ['.ng', '.com.ng', '.org.ng', '.net.ng', '.com'],
    'GH': ['.gh', '.com.gh', '.org.gh', '.net.gh', '.com'],
    'KE': ['.ke', '.co.ke', '.or.ke', '.ne.ke', '.com'],
    'EG': ['.eg', '.com.eg', '.org.eg', '.net.eg', '.com'],
    'PK': ['.pk', '.com.pk', '.org.pk', '.net.pk', '.com'],
    'BD': ['.bd', '.com.bd', '.org.bd', '.net.bd', '.com'],
    'PE': ['.pe', '.com.pe', '.org.pe', '.net.pe', '.com'],
    'VE': ['.ve', '.com.ve', '.org.ve', '.net.ve', '.com'],
    'UA': ['.ua', '.com.ua', '.org.ua', '.net.ua', '.com'],
    'CZ': ['.cz', '.com.cz', '.org.cz', '.net.cz', '.com'],
    'HU': ['.hu', '.co.hu', '.org.hu', '.net.hu', '.com'],
    'RO': ['.ro', '.com.ro', '.org.ro', '.net.ro', '.com'],
    'BG': ['.bg', '.com.bg', '.org.bg', '.net.bg', '.com'],
    'HR': ['.hr', '.com.hr', '.org.hr', '.net.hr', '.com'],
    'RS': ['.rs', '.com.rs', '.org.rs', '.net.rs', '.com'],
    'SK': ['.sk', '.com.sk', '.org.sk', '.net.sk', '.com'],
    'SI': ['.si', '.com.si', '.org.si', '.net.si', '.com'],
    'LT': ['.lt', '.com.lt', '.org.lt', '.net.lt', '.com'],
    'LV': ['.lv', '.com.lv', '.org.lv', '.net.lv', '.com'],
    'EE': ['.ee', '.com.ee', '.org.ee', '.net.ee', '.com'],
    'MA': ['.ma', '.co.ma', '.org.ma', '.net.ma', '.com'],
    'DZ': ['.dz', '.com.dz', '.org.dz', '.net.dz', '.com'],
    'TN': ['.tn', '.com.tn', '.org.tn', '.net.tn', '.com'],
    'ET': ['.et', '.com.et', '.org.et', '.net.et', '.com'],
    'TZ': ['.tz', '.co.tz', '.or.tz', '.ne.tz', '.com'],
    'UG': ['.ug', '.co.ug', '.or.ug', '.ne.ug', '.com'],
    'KZ': ['.kz', '.com.kz', '.org.kz', '.net.kz', '.com'],
    'UZ': ['.uz', '.com.uz', '.org.uz', '.net.uz', '.com'],
    'MN': ['.mn', '.com.mn', '.org.mn', '.net.mn', '.com'],
    'LK': ['.lk', '.com.lk', '.org.lk', '.net.lk', '.com'],
    'NP': ['.np', '.com.np', '.org.np', '.net.np', '.com'],
    'FJ': ['.fj', '.com.fj', '.org.fj', '.net.fj', '.com'],
    'PG': ['.pg', '.com.pg', '.org.pg', '.net.pg', '.com'],
      'AF': ['.af', '.com', '.org', '.net'],
  'AL': ['.al', '.com', '.org', '.net'],
  'AD': ['.ad', '.com', '.org', '.net'],
  'AO': ['.ao', '.co.ao', '.org.ao', '.net.ao', '.com'],
  'AM': ['.am', '.com', '.org', '.net'],
  'AZ': ['.az', '.com', '.org', '.net'],
  'BH': ['.bh', '.com.bh', '.org.bh', '.net.bh', '.com'],
  'BY': ['.by', '.com', '.org', '.net'],
  'BZ': ['.bz', '.com.bz', '.org.bz', '.net.bz', '.com'],
  'BJ': ['.bj', '.com', '.org', '.net'],
  'BT': ['.bt', '.com.bt', '.org.bt', '.net.bt', '.com'],
  'BA': ['.ba', '.com.ba', '.org.ba', '.net.ba', '.com'],
  'BW': ['.bw', '.co.bw', '.org.bw', '.net.bw', '.com'],
  'BN': ['.bn', '.com.bn', '.org.bn', '.net.bn', '.com'],
  'BF': ['.bf', '.com', '.org', '.net'],
  'BI': ['.bi', '.co.bi', '.org.bi', '.net.bi', '.com'],
  'KH': ['.kh', '.com.kh', '.org.kh', '.net.kh', '.com'],
  'CM': ['.cm', '.co.cm', '.org.cm', '.net.cm', '.com'],
  'CV': ['.cv', '.com.cv', '.org.cv', '.net.cv', '.com'],
  'CF': ['.cf', '.com.cf', '.org.cf', '.net.cf', '.com'],
  'TD': ['.td', '.com', '.org', '.net'],
  'KM': ['.km', '.com.km', '.org.km', '.net.km', '.com'],
  'CG': ['.cg', '.com.cg', '.org.cg', '.net.cg', '.com'],
  'CD': ['.cd', '.com', '.org', '.net'],
  'CR': ['.cr', '.co.cr', '.or.cr', '.fi.cr', '.com'],
  'CI': ['.ci', '.com.ci', '.org.ci', '.net.ci', '.com'],
  'CU': ['.cu', '.com.cu', '.org.cu', '.net.cu', '.com'],
  'CY': ['.cy', '.com.cy', '.org.cy', '.net.cy', '.com'],
  'DJ': ['.dj', '.com.dj', '.org.dj', '.net.dj', '.com'],
  'DM': ['.dm', '.com.dm', '.org.dm', '.net.dm', '.com'],
  'DO': ['.do', '.com.do', '.org.do', '.net.do', '.com'],
  'EC': ['.ec', '.com.ec', '.org.ec', '.net.ec', '.com'],
  'SV': ['.sv', '.com.sv', '.org.sv', '.net.sv', '.com'],
  'GQ': ['.gq', '.com.gq', '.org.gq', '.net.gq', '.com'],
  'ER': ['.er', '.com.er', '.org.er', '.net.er', '.com'],
  'SZ': ['.sz', '.co.sz', '.org.sz', '.net.sz', '.com'],
  'GA': ['.ga', '.com.ga', '.org.ga', '.net.ga', '.com'],
  'GM': ['.gm', '.com.gm', '.org.gm', '.net.gm', '.com'],
  'GE': ['.ge', '.com.ge', '.org.ge', '.net.ge', '.com'],
  'GD': ['.gd', '.com.gd', '.org.gd', '.net.gd', '.com'],
  'GT': ['.gt', '.com.gt', '.org.gt', '.net.gt', '.com'],
  'GN': ['.gn', '.com.gn', '.org.gn', '.net.gn', '.com'],
  'GW': ['.gw', '.com.gw', '.org.gw', '.net.gw', '.com'],
  'GY': ['.gy', '.com.gy', '.org.gy', '.net.gy', '.com'],
  'HT': ['.ht', '.com.ht', '.org.ht', '.net.ht', '.com'],
  'HN': ['.hn', '.com.hn', '.org.hn', '.net.hn', '.com'],
  'IS': ['.is', '.com', '.org', '.net'],
  'IQ': ['.iq', '.com.iq', '.org.iq', '.net.iq', '.com'],
  'IR': ['.ir', '.co.ir', '.org.ir', '.net.ir', '.com'],
  'JM': ['.jm', '.com.jm', '.org.jm', '.net.jm', '.com'],
  'JO': ['.jo', '.com.jo', '.org.jo', '.net.jo', '.com'],
  'KG': ['.kg', '.com.kg', '.org.kg', '.net.kg', '.com'],
  'LA': ['.la', '.com.la', '.org.la', '.net.la', '.com'],
  'LB': ['.lb', '.com.lb', '.org.lb', '.net.lb', '.com'],
  'LS': ['.ls', '.co.ls', '.org.ls', '.net.ls', '.com'],
  'LR': ['.lr', '.com.lr', '.org.lr', '.net.lr', '.com'],
  'LY': ['.ly', '.com.ly', '.org.ly', '.net.ly', '.com'],
  'LI': ['.li', '.com', '.org', '.net'],
  'LU': ['.lu', '.com', '.org', '.net'],
  'MG': ['.mg', '.com.mg', '.org.mg', '.net.mg', '.com'],
  'MW': ['.mw', '.com.mw', '.org.mw', '.net.mw', '.com'],
  'MV': ['.mv', '.com.mv', '.org.mv', '.net.mv', '.com'],
  'ML': ['.ml', '.com.ml', '.org.ml', '.net.ml', '.com'],
  'MT': ['.mt', '.com', '.org', '.net'],
  'MH': ['.mh', '.com.mh', '.org.mh', '.net.mh', '.com'],
  'MR': ['.mr', '.com.mr', '.org.mr', '.net.mr', '.com'],
  'MU': ['.mu', '.co.mu', '.org.mu', '.net.mu', '.com'],
  'FM': ['.fm', '.com.fm', '.org.fm', '.net.fm', '.com'],
  'MD': ['.md', '.com.md', '.org.md', '.net.md', '.com'],
  'MC': ['.mc', '.com', '.org', '.net'],
  'ME': ['.me', '.co.me', '.org.me', '.net.me', '.com'],
  'MZ': ['.mz', '.co.mz', '.org.mz', '.net.mz', '.com'],
  'MM': ['.mm', '.com.mm', '.org.mm', '.net.mm', '.com'],
  'NA': ['.na', '.com.na', '.org.na', '.net.na', '.com'],
  'NR': ['.nr', '.com.nr', '.org.nr', '.net.nr', '.com'],
  'NI': ['.ni', '.com.ni', '.org.ni', '.net.ni', '.com'],
  'NE': ['.ne', '.com.ne', '.org.ne', '.net.ne', '.com'],
  'MK': ['.mk', '.com.mk', '.org.mk', '.net.mk', '.com'],
  'OM': ['.om', '.co.om', '.org.om', '.net.om', '.com'],
  'PW': ['.pw', '.com.pw', '.org.pw', '.net.pw', '.com'],
  'PA': ['.pa', '.com.pa', '.org.pa', '.net.pa', '.com'],
  'PY': ['.py', '.com.py', '.org.py', '.net.py', '.com'],
  'QA': ['.qa', '.com.qa', '.org.qa', '.net.qa', '.com'],
  'RW': ['.rw', '.co.rw', '.org.rw', '.net.rw', '.com'],
  'KN': ['.kn', '.com.kn', '.org.kn', '.net.kn', '.com'],
  'LC': ['.lc', '.com.lc', '.org.lc', '.net.lc', '.com'],
  'VC': ['.vc', '.com.vc', '.org.vc', '.net.vc', '.com'],
  'WS': ['.ws', '.com.ws', '.org.ws', '.net.ws', '.com'],
  'SM': ['.sm', '.com', '.org', '.net'],
  'ST': ['.st', '.com.st', '.org.st', '.net.st', '.com'],
  'SN': ['.sn', '.com.sn', '.org.sn', '.net.sn', '.com'],
  'SC': ['.sc', '.com.sc', '.org.sc', '.net.sc', '.com'],
  'SL': ['.sl', '.com.sl', '.org.sl', '.net.sl', '.com'],
  'SB': ['.sb', '.com.sb', '.org.sb', '.net.sb', '.com'],
  'SO': ['.so', '.com.so', '.org.so', '.net.so', '.com'],
  'SS': ['.ss', '.com', '.org', '.net'],
  'SD': ['.sd', '.com.sd', '.org.sd', '.net.sd', '.com'],
  'SR': ['.sr', '.com.sr', '.org.sr', '.net.sr', '.com'],
  'SY': ['.sy', '.com.sy', '.org.sy', '.net.sy', '.com'],
  'TJ': ['.tj', '.com.tj', '.org.tj', '.net.tj', '.com'],
  'TL': ['.tl', '.com.tl', '.org.tl', '.net.tl', '.com'],
  'TG': ['.tg', '.com.tg', '.org.tg', '.net.tg', '.com'],
  'TO': ['.to', '.com.to', '.org.to', '.net.to', '.com'],
  'TT': ['.tt', '.com.tt', '.org.tt', '.net.tt', '.com'],
  'TM': ['.tm', '.com.tm', '.org.tm', '.net.tm', '.com'],
  'TV': ['.tv', '.com.tv', '.org.tv', '.net.tv', '.com'],
  'UY': ['.uy', '.com.uy', '.org.uy', '.net.uy', '.com'],
  'VU': ['.vu', '.com.vu', '.org.vu', '.net.vu', '.com'],
  'VA': ['.va', '.com', '.org', '.net'],
  'YE': ['.ye', '.com.ye', '.org.ye', '.net.ye', '.com'],
  'ZM': ['.zm', '.co.zm', '.org.zm', '.net.zm', '.com'],
  'ZW': ['.zw', '.co.zw', '.org.zw', '.net.zw', '.com']
  },
  countryDialingCodeMapping: {
    'US': '+1',
    'CA': '+1',
    'GB': '+44',
    'AU': '+61',
    'DE': '+49',
    'FR': '+33',
    'JP': '+81',
    'IN': '+91',
    'BR': '+55',
    'CN': '+86',
    'ES': '+34',
    'IT': '+39',
    'NL': '+31',
    'SE': '+46',
    'CH': '+41',
    'MX': '+52',
    'SG': '+65',
    'NZ': '+64',
    'IE': '+353',
    'ZA': '+27',
    'AE': '+971',
    'AR': '+54',
    'AT': '+43',
    'BE': '+32',
    'CL': '+56',
    'CO': '+57',
    'DK': '+45',
    'FI': '+358',
    'GR': '+30',
    'HK': '+852',
    'ID': '+62',
    'IL': '+972',
    'KR': '+82',
    'MY': '+60',
    'NO': '+47',
    'PH': '+63',
    'PL': '+48',
    'PT': '+351',
    'RU': '+7',
    'SA': '+966',
    'TH': '+66',
    'TR': '+90',
    'TW': '+886',
    'VN': '+84',
    'NG': '+234',
    'GH': '+233',
    'KE': '+254',
    'EG': '+20', 'PK': '+92', 'BD': '+880', 'PE': '+51', 'VE': '+58',
    'UA': '+380', 'CZ': '+420', 'HU': '+36', 'RO': '+40', 'BG': '+359',
    'HR': '+385', 'RS': '+381', 'SK': '+421', 'SI': '+386', 'LT': '+370',
    'LV': '+371', 'EE': '+372', 'MA': '+212', 'DZ': '+213', 'TN': '+216',
    'ET': '+251', 'TZ': '+255', 'UG': '+256', 'KZ': '+7', 'UZ': '+998',
    'MN': '+976', 'LK': '+94', 'NP': '+977', 'FJ': '+679', 'PG': '+675',
      'AF': '+93', 'AL': '+355', 'AD': '+376', 'AO': '+244',
  'AM': '+374', 'AZ': '+994', 'BH': '+973', 'BY': '+375',
  'BZ': '+501', 'BJ': '+229', 'BT': '+975', 'BA': '+387',
  'BW': '+267', 'BN': '+673', 'BF': '+226', 'BI': '+257',
  'KH': '+855', 'CM': '+237', 'CV': '+238', 'CF': '+236',
  'TD': '+235', 'KM': '+269', 'CG': '+242', 'CD': '+243',
  'CR': '+506', 'CI': '+225', 'CU': '+53', 'CY': '+357',
  'DJ': '+253', 'DM': '+1', 'DO': '+1', 'EC': '+593',
  'SV': '+503', 'GQ': '+240', 'ER': '+291', 'SZ': '+268',
  'GA': '+241', 'GM': '+220', 'GE': '+995', 'GD': '+1',
  'GT': '+502', 'GN': '+224', 'GW': '+245', 'GY': '+592',
  'HT': '+509', 'HN': '+504', 'IS': '+354', 'IQ': '+964',
  'IR': '+98', 'JM': '+1', 'JO': '+962', 'KG': '+996',
  'LA': '+856', 'LB': '+961', 'LS': '+266', 'LR': '+231',
  'LY': '+218', 'LI': '+423', 'LU': '+352', 'MG': '+261',
  'MW': '+265', 'MV': '+960', 'ML': '+223', 'MT': '+356',
  'MH': '+692', 'MR': '+222', 'MU': '+230', 'FM': '+691',
  'MD': '+373', 'MC': '+377', 'ME': '+382', 'MZ': '+258',
  'MM': '+95', 'NA': '+264', 'NR': '+674', 'NI': '+505',
  'NE': '+227', 'MK': '+389', 'OM': '+968', 'PW': '+680',
  'PA': '+507', 'PY': '+595', 'QA': '+974', 'RW': '+250',
  'KN': '+1', 'LC': '+1', 'VC': '+1', 'WS': '+685',
  'SM': '+378', 'ST': '+239', 'SN': '+221', 'SC': '+248',
  'SL': '+232', 'SB': '+677', 'SO': '+252', 'SS': '+211',
  'SD': '+249', 'SR': '+597', 'SY': '+963', 'TJ': '+992',
  'TL': '+670', 'TG': '+228', 'TO': '+676', 'TT': '+1',
  'TM': '+993', 'TV': '+688', 'UY': '+598', 'VU': '+678',
  'VA': '+379', 'YE': '+967', 'ZM': '+260', 'ZW': '+263'
  },

  
irrelevantPhrases: [
'team member','general contact','find us','contact us','about us','our team','read more','view all','copyright','privacy policy','terms of service',
'member','email member','send email','get in touch','reach out','inquiry','support','help','admin','administrator','info','sales','hr','human resources',
'customer service','technical support','billing','accounts','finance','marketing','press','media','news','events','careers','jobs','recruiting',
'partnerships','business development','investors','board','leadership','executives','management','staff','personnel','directory','phone','fax',
'address','location','map','directions','office','headquarters','branch','department','division','group','committee','association','organization',
'noreply','no-reply','no reply','do not reply','donotreply','postmaster','','site admin','admin team','support team','helpdesk','tech support',
'feedback','suggestions','web contact','client services','account manager','accounting','legal','privacy','terms','press office','media relations',
'home','menu','navigation','footer','header','sidebar','main','content','page','site','website','online','web','portal','platform',
'login','register','signup','signin','logout','account','profile','dashboard','settings','preferences','user','guest','visitor',
'download','upload','file','document','image','video','audio','pdf','doc','xls','ppt','zip','rar','exe','app','software',
'search','filter','sort','order','buy','sell','purchase','cart','checkout','payment','shipping','delivery','tracking',
'subscribe','newsletter','blog','forum','community','social','share','like','comment','post','thread','topic','discussion',
'faq','help center','knowledge base','tutorial','guide','manual','documentation','api','developer','code','script','plugin',
'cookie','analytics','tracking','gdpr','compliance','security','encryption','ssl','https','domain','hosting','server',
'error','404','500','maintenance','coming soon','under construction','temporarily unavailable','redirect','link','url',
'button','form','input','John Doe','textarea','select','checkbox','radio','submit','reset','cancel','close','open','toggle','expand','collapse',
'icon','logo','banner','advertisement','ad','promo','offer','deal','discount','coupon','voucher','gift','free','trial',
'call to action','cta','landing page','homepage','index','default','welcome','hello','hi','greetings','thanks','thank you',
'contact form','message','subject','body','attachment','captcha','verification','confirm','validate','authenticate',
'system','automatic','bot','robot','crawler','spider','indexer','search engine','google','bing','yahoo','duckduckgo',
'meta','tag','keyword','description','title','heading','paragraph','list','table','row','column','cell','div','span','class','id',
'javascript','jquery','css','html','xml','json','endpoint','request','response','status','header','body',
'database','query','record','field','value','key','index','constraint','trigger','procedure',
'backup','restore','sync','update','upgrade','patch','version','release','changelog','roadmap','milestone','sprint',
'project','task','issue','bug','feature','enhancement','fix','deploy','staging','production','dev','test',
'integration','continuous','deployment','pipeline','workflow','automation','ci cd','git','github','gitlab','repository','repo',
'branch','commit','merge','pull request','push','clone','fork','source','codebase','library','framework',
'dependency','package','module','component','widget','plugin','extension','addon','theme','template','layout','design',
'color','font','style','responsive','mobile','desktop','tablet','screen','resolution','pixel','viewport',
'accessibility','aria','alt text','screen reader','keyboard navigation',
'performance','speed','optimization','cache','compression','lazy loading','cdn',
'cloud','aws','azure','gcp','firebase','digitalocean',
'docker','kubernetes','container','virtual machine','serverless','lambda','microservice','monolith',
'agile','scrum','kanban','waterfall','methodology','process','workflow',
'developer','tester','qa','analyst','architect','engineer','specialist','consultant',
'vendor','supplier','partner','client','customer','user','stakeholder','shareholder','investor',
'manager','director','vp','executive','officer','chairman','president','secretary','treasurer','advisor',
'recruiter','hiring manager','talent acquisition','people operations','employee experience',
'compensation','benefits','payroll','onboarding','offboarding','performance review','training',
'compliance','policy','procedure','handbook','ethics','diversity','inclusion','culture',
'remote work','hybrid','workspace','meeting room','conference','webinar','seminar','workshop',
'presentation','demo','pitch','proposal','contract','agreement','nda','sla','disclaimer',
'insurance','risk','assessment','audit','certification','regulation','law',
'intellectual property','patent','trademark','copyright','license',
'merger','acquisition','ipo','valuation','funding','investment','venture capital','angel investor',
'revenue','profit','loss','margin','roi','kpi','metric','analytics','reporting','dashboard',
'market research','survey','interview','focus group','testing',
'conversion','funnel','retention','churn','segmentation','persona','journey','experience',
'brand','identity','tagline','messaging','content','copywriting','seo','sem','ppc',
'influencer','ambassador','advocate','referral','affiliate','sponsorship','testimonial','review',
'rating','complaint','resolution','satisfaction','loyalty','engagement',
'reach','impression','click','goal','objective','strategy','tactic','campaign','initiative','program',
'timeline','deadline','deliverable','scope','budget','resource','allocation','roadmap',
'get listed','list your business','add business','add listing','submit business','claim listing','claim your business',
'remove listing','remove company','edit listing','featured listing','premium listing','top listings',
'browse categories','all categories','view category','popular searches','top companies','related companies',
'nearby businesses','similar companies','business listing','company listing','directory listing',
'read more','learn more','see more','view more','click here','tap here','load more','show more',
'back to top','next page','previous page','open menu','close menu','quick links','useful links',
'log in','sign in','sign up','create account','forgot password','reset password','join now','register now','my account',
'nigeria','lagos','abuja','port harcourt','ceo','cto','cfo','cmo','cio','cso','board member','advisory board','executive board','senior','junior','associate'
,'principal','fellow','intern','apprentice','alumni','faculty','our people','staff list','leadership team','management team','board of directors','executive committee',
'all rights reserved','terms of use','cookie policy','site map','back to top',
'next page','previous page','page of','powered by','developed by','designed by','phone number','email address','contact info','ibadan','ghana','kenya','africa',
'head office','main office','regional office','global office',
'latest articles','recent posts','blog post','news update','featured article','press release','trending topics',
'apply now','contact now','buy now','order now','get started','start now','request quote','get quote',
'subscribe now','download now','watch video','play video',
'follow us','share this','like us','join community','invite friends','leave a comment','post comment',
'all rights reserved','terms and conditions','privacy notice','cookie policy','legal notice','site map','Email Member','@1x.png'
],
  irrelevantKeywords: [
    'glassdoor', 'linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'wikipedia',
    'bloomberg', 'forbes', 'fortune', 'inc', 'reuters', 'techcrunch', 'wsj', 'nytimes', 'washingtonpost', 'theguardian', 'bbc', 'cnn', 'cnbc',
    'businessinsider', 'fastcompany', 'wired', 'marketwatch', 'money.cnn', 'seekingalpha', 'thestreet', 'yahoo', 'ycombinator',
    'crunchbase', 'owler', 'zoominfo', 'apollo.io', 'dnb.com', 'hoovers', 'manta', 'yellowpages', 'yelp', 'thomasnet',
    'alibaba', 'amazon', 'ebay', 'etsy', 'walmart', 'duckduckgo'
  ],
  
  dataFile: 'leads.json',
}

let leads = [];
if (fs.existsSync(CONFIG.dataFile)) {
  try {
    const data = fs.readFileSync(CONFIG.dataFile, 'utf8');
    if (data) { // Check if data is not empty
      leads = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading or parsing leads.json:', error);
    // If there's an error, leads remains an empty array
  }
}










// ---------- EMAIL FUNCTION ----------











// ---------- UTILITY ----------
const randomInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const wait = ms => new Promise(r => setTimeout(r, ms));
function isAllowedTime() {
  return true;
}

function isValidDomain(domain) {
  const domainRegex = /^(?!-)[A-Za-z0-9-]+([\-\.]{1}[a-z0-9]+)*\.[A-Za-z]{2,6}$/;
  return domainRegex.test(domain);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Define a hierarchy for job titles to determine "least position"
const jobTitleHierarchy = {
  // Higher score means higher position
  'founder': 10, 'ceo': 10, 'chief executive officer': 10,
  'president': 9,
  'cfo': 8, 'chief financial officer': 8,
  'coo': 8, 'chief operating officer': 8,
  'cto': 8, 'chief technology officer': 8,
  'cmo': 8, 'chief marketing officer': 8,
  'vp': 7, 'vice president': 7,
  'director': 6,
  'head of': 5, 'manager': 5,
  'lead': 4, 'senior': 4,
  'specialist': 3, 'analyst': 3, 'associate': 3,
  'junior': 2,
  'intern': 1,
  'assistant': 1,
  'representative': 1,
  'executive': 1, // Often entry-level in some contexts
  'officer': 1, // Can be entry-level in some contexts
  'coordinator': 1,
  'administrator': 1,
  'support': 1,
  'clerk': 1,
  'staff': 1,
  'member': 1,
  'general contact': 0, // Lowest possible score for generic contacts
};

function getJobTitleScore(title) {
  if (!title) return 0;
  const lowerTitle = title.toLowerCase();
  for (const keyword in jobTitleHierarchy) {
    if (lowerTitle.includes(keyword)) {
      return jobTitleHierarchy[keyword];
    }
  }
  return 0; // Default to lowest score if no keyword matches
}

// ---------- UTILITY FUNCTIONS ----------
function loadLeads() {
  if (!fs.existsSync(CONFIG.dataFile)) {
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const data = fs.readFileSync(CONFIG.dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading or parsing leads.json:', error);
    // If the file is corrupted, back it up and start with a fresh one
    fs.renameSync(CONFIG.dataFile, `${CONFIG.dataFile}.bak`);
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify([], null, 2));
    return [];
  }
}







async function findPeoplePage(page, websiteUrl) {
  const peoplePageKeywords = ['team', 'about', 'contact', 'leadership', 'management', 'board', 'staff', 'people', 'our story'];
  const potentialUrls = await page.$$eval('a, button', (elements, keywords, baseUrl) => {
    const urls = new Set();
    elements.forEach(element => {
      const text = element.textContent ? element.textContent.toLowerCase() : '';
      const href = element.href || element.getAttribute('data-href'); // Get href for <a> or data-href for <button>

      if (href && href.startsWith(baseUrl)) {
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            urls.add(href);
            break;
          }
        }
      }
    });
    return Array.from(urls);
  }, peoplePageKeywords, websiteUrl);

  return potentialUrls;
}

async function findContactPage(page, websiteUrl) {
  const contactPageKeywords = ['contact', 'reach us', 'get in touch', 'support', 'enquiry', 'inquiry'];
  const potentialUrls = await page.$$eval('a, button', (elements, keywords, baseUrl) => {
    const urls = new Set();
    elements.forEach(element => {
      const text = element.textContent ? element.textContent.toLowerCase() : '';
      const href = element.href || element.getAttribute('data-href'); // Get href for <a> or data-href for <button>
      if (href && href.startsWith(baseUrl)) {
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            urls.add(href);
            break;
          }
        }
      }
    });
    return Array.from(urls);
  }, contactPageKeywords, websiteUrl);
  return potentialUrls;
}

// function saveSentLeads(sentLeads) {
//   const sentLeadsFile = path.join(__dirname, 'sent_leads.json');
//   console.log(`Moving ${sentLeads.length} completed lead(s) to ${sentLeadsFile}`);
//   let existingSentLeads = [];
//   if (fs.existsSync(sentLeadsFile)) {
//     existingSentLeads = JSON.parse(fs.readFileSync(sentLeadsFile));
//   }
//   const allSentLeads = existingSentLeads.concat(sentLeads);
//   fs.writeFileSync(sentLeadsFile, JSON.stringify(allSentLeads, null, 2));
// }

// ---------- SCRAPING ----------
async function getWebsitesByIndustry(industry, browser, countryCode = null, dialingCode = null) {
  const allLinks = new Set();
  let tldsToSearch;

  if (countryCode && CONFIG.countryTldMapping[countryCode]) {
    tldsToSearch = shuffleArray([...CONFIG.countryTldMapping[countryCode]]).slice(0, 15);
    console.log(`Searching TLDs for ${countryCode}: ${tldsToSearch.join(', ')}`);
  } else {
    tldsToSearch = shuffleArray([...CONFIG.searchTlds]).slice(0, 15);
    console.log(`Searching global TLDs: ${tldsToSearch.join(', ')}`);
  }

  for (const tld of tldsToSearch) {
    let page;

    try {
      page = await browser.newPage();

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
      );

      await page.setViewport({ width: 1366, height: 768 });
      // Use HTML version of DuckDuckGo and fix site search parameter
      let query = `"${industry}" contact OR about OR "${industry}" site:${tld.substring(1)}`;
      if (dialingCode) {
        query += ` "${dialingCode}"`;
      }
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

      // Selector for the HTML version
      const links = await page.$$eval('a.result__a', anchors =>
        anchors.map(a => a.href)
      );

      if (links.length === 0) {
        fs.writeFileSync('debug.html', await page.content());
      }

      const cleanedLinks = links.map(link => {
        try {
          const url = new URL(link);
          // Ensure it's a valid web URL with a hostname
          if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
            return null;
          }

          // The HTML version also uses a redirect with 'uddg' parameter
          if (url.hostname.includes('duckduckgo.com') && url.searchParams.has('uddg')) {
            const uddgUrl = url.searchParams.get('uddg');
            try {
              const parsedUddgUrl = new URL(uddgUrl);
              // Validate the extracted uddgUrl before returning
              if (!['http:', 'https:'].includes(parsedUddgUrl.protocol) || !parsedUddgUrl.hostname) {
                return null;
              }
              return uddgUrl;
            } catch (e) {
              return null; // uddgUrl is malformed
            }
          }
          return link;
        } catch (e) {
          // If URL is malformed, return null to filter it out later
          return null;
        }
      }).filter(link => link !== null); // Filter out nulls (malformed URLs)

      const filteredLinks = cleanedLinks.filter(link => {
        try {
            const hasIrrelevantKeyword = CONFIG.irrelevantKeywords.some(keyword => link.includes(keyword));
            return !hasIrrelevantKeyword;
        } catch (error) {
            return false;
        }
      });

      filteredLinks.forEach(link => allLinks.add(link));

    } catch (error) {
      console.error(`Could not scrape for TLD ${tld}: ${error.message}`);
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
  return [...allLinks];
}


async function extractEmailsFromWebsite(url, browser, io, loadLeads, saveLeads, dialingCodeToUse = '') {
  const visited = new Set();
  const scrapedEmails = new Set();
  const scrapedPhoneNumbers = new Set(); // Declare scrapedPhoneNumbers here
  const queue = [url];
  visited.add(url);

  let page;
  let initialHost = '';
  let companyName = '';
  let scrapedPeople = []; // Will store names, titles, and emails found via scraping
  let sender = null; // Will be selected from scrapedPeople
  let apolloContacts = []; // Initialize apolloContacts here

  try {
    page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    );

    await page.setViewport({ width: 1366, height: 768 });

    const urlObj = new URL(url);
    initialHost = urlObj.hostname;
    // Remove 'www.' if present
    if (initialHost.startsWith('www.')) {
      initialHost = initialHost.substring(4);
    }
    companyName = initialHost.split('.')[0]; // Simple company name extraction

    console.log(`Starting data extraction for ${url} (Domain: ${initialHost}, Company: ${companyName})`);


    const fileExtensionsToIgnore = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.rar', '.mp3', '.mp4', 'avi', '.mov', '.wmv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
    const contactKeywords = ['contact', 'about', 'team', 'impressum'];


    while (queue.length > 0) {
      const currentUrl = queue.shift();


      if (visited.size >= CONFIG.maxPagesToVisit) {
        console.log(`Reached max pages to visit for ${url}`);
        break;
      }


      if (fileExtensionsToIgnore.some(ext => currentUrl.toLowerCase().endsWith(ext))) {
        continue;
      }


      let success = false;
      for (let i = 0; i < 5; i++) {
        try {
          await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          const content = await page.content();
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
          const foundEmails = content.match(emailRegex) || [];
          foundEmails.forEach(email => scrapedEmails.add(email)); // Scraped emails are added here

          // Regex for phone numbers, including international formats
          const phoneRegex = /(?:(?:\+|00)\d{1,3}[\s.-]?)?\(?\d{2,4}\)?(?:[\s.-]?\d{2,4}){2,4}/g;

          const allPotentialPhoneMatches = [];
          let match;
          while ((match = phoneRegex.exec(content)) !== null) {
              allPotentialPhoneMatches.push({
                  value: match[0],
                  index: match.index
              });
          }

          const negativePhoneKeywords = ['fax', 'date', 'time', 'year', 'month', 'day', 'birth', 'expiry', 'valid', 'since', 'until', 'from', 'to', 'product id', 'order id', 'invoice id', 'reference number', 'serial number', 'version', 'code', 'zip code', 'post code'];

          for (const potentialPhone of allPotentialPhoneMatches) {
              const phone = potentialPhone.value;
              const index = potentialPhone.index;

              // Extract a snippet of text before and after the phone number to check for negative keywords
              const preText = content.substring(Math.max(0, index - 50), index).toLowerCase(); // Check up to 50 chars before
              const postText = content.substring(index + phone.length, Math.min(content.length, index + phone.length + 50)).toLowerCase(); // Check up to 50 chars after

              let isIrrelevantContext = false;
              for (const keyword of negativePhoneKeywords) {
                  if (preText.includes(keyword) || postText.includes(keyword)) {
                      isIrrelevantContext = true;
                      break;
                  }
              }

              if (isIrrelevantContext) {
                  console.log(`[DEBUG] Skipping potential phone number due to irrelevant context: "${phone}" (Context: "...${preText.slice(-20)}...${postText.slice(0, 20)}")`);
                  continue; // Skip this phone number
              }

              // Use libphonenumber-js for robust validation
              let phoneNumber;
              try {
                  // Try parsing with the provided dialingCodeToUse as default country
                  phoneNumber = parsePhoneNumberFromString(phone, dialingCodeToUse || 'US'); // Default to 'US' if no dialingCodeToUse
                  if (!phoneNumber || !phoneNumber.isValid()) {
                      // If not valid with default country, try parsing without a default country
                      phoneNumber = parsePhoneNumberFromString(phone);
                  }
              } catch (e) {
                  // console.log(`[DEBUG] libphonenumber-js parsing error for "${phone}": ${e.message}`);
                  continue; // Skip if parsing fails
              }

              if (phoneNumber && phoneNumber.isValid()) {
                  scrapedPhoneNumbers.add(phoneNumber.formatInternational());
              } else {
                  console.log(`[DEBUG] Skipping invalid phone number after libphonenumber-js validation: "${phone}"`);
              }
          }


          const links = await page.$$eval('a', as => as.map(a => a.href));


          const internalLinks = links
            .map(link => {
              try {
                return new URL(link, currentUrl).href;
              } catch (e) {
                return null;
              }
            })
            .filter(link => {
              if (!link) return false;
              try {
                const linkUrl = new URL(link);
                return linkUrl.hostname === initialHost && !visited.has(link) && (linkUrl.protocol === 'http:' || linkUrl.protocol === 'https');
              } catch (e) {
                return false;
              }
            });


          const priorityLinks = internalLinks.filter(link => contactKeywords.some(keyword => link.toLowerCase().includes(keyword)));
          const otherLinks = internalLinks.filter(link => !contactKeywords.some(keyword => link.toLowerCase().includes(keyword)));


          const linksToQueue = [...priorityLinks, ...otherLinks];


          for (const link of linksToQueue) {
            if (visited.size >= CONFIG.maxPagesToVisit) break;
            if (!visited.has(link)) {
              visited.add(link);
              if (priorityLinks.includes(link)) {
                queue.unshift(link); // Add priority links to the front
              } else {
                queue.push(link);
              }
            }
          }
          success = true;
          break;
        } catch (err) {
          const isRetryableError = err.name === 'TimeoutError' || 
            err.message.includes('net::ERR_CONNECTION_TIMED_OUT') || 
            err.message.includes('net::ERR_NAME_NOT_RESOLVED') || 
            err.message.includes('net::ERR_CONNECTION_REFUSED') ||
            err.message.includes('net::ERR_CERT_DATE_INVALID') ||
            err.message.includes('net::ERR_CERT_AUTHORITY_INVALID') ||
            err.message.includes('SSL') ||
            err.message.includes('CERT');
          if (!isRetryableError) {
            console.log(`Attempt ${i + 1} failed for ${currentUrl}: ${err.message}`);
          }
          if (i === 4 && !isRetryableError) {
            console.log(`Failed to visit ${currentUrl} after 5 attempts.`);
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'TimeoutError' || 
        error.message.includes('net::ERR_CONNECTION_TIMED_OUT') || 
        error.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
        error.message.includes('net::ERR_CERT_DATE_INVALID') ||
        error.message.includes('net::ERR_CERT_AUTHORITY_INVALID') ||
        error.message.includes('SSL') ||
        error.message.includes('CERT')) {
      // Silently ignore retryable errors on initial URL load
    } else {
      console.error(`An error occurred while extracting emails from ${url}:`, error);
    }
  }

//   // --- NEW SCRAPING LOGIC FOR PEOPLE DATA GOES HERE ---
  console.log(`[INFO] Starting enhanced scraping for people data on ${initialHost}...`);

  const peoplePages = await findPeoplePage(page, url);
  const contactPages = await findContactPage(page, url);

  const potentialPeoplePages = new Set([...peoplePages, ...contactPages]);

  // If no direct links found, try constructing common people page URLs as a fallback
  if (potentialPeoplePages.size === 0) {
    const peoplePageKeywords = [
      'team','contact', 'management','about-us', 'executives', 'board',
      'staff', 'who-we-are', 'our-team', 'meet-the-team',
      'personnel', 'employees',
      'members', 'directors'
    ];
    const domainParts = initialHost.split('.');
    const isBareDomain = domainParts.length <= 2;

    for (const keyword of peoplePageKeywords) {
      potentialPeoplePages.add(`https://${initialHost}/${keyword}`);
      potentialPeoplePages.add(`https://${initialHost}/${keyword}/`);

      if (isBareDomain) {
        potentialPeoplePages.add(`https://www.${initialHost}/${keyword}`);
        potentialPeoplePages.add(`https://www.${initialHost}/${keyword}/`);
      }
    }
  }
    
// Function to validate if a string is a plausible name

  
function isValidName(name, title, irrelevantPhrases) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return false;
  }

  // Normalize everything to lowercase ONCE
  const normalizedName = name.toLowerCase().trim();
  const normalizedTitle = (title || '').toLowerCase().trim();

  //Check irrelevant phrases (case-insensitive)
  const isIrrelevant = irrelevantPhrases.some(phrase => {
    const p = phrase.toLowerCase();
    return normalizedName.includes(p) || normalizedTitle.includes(p);
  });

  if (isIrrelevant) return false;

  // Remove weird characters before validation
  const cleanName = name.replace(/[^a-zA-Z\s'-]/g, '');

  // Reject names with numbers
  if (/\d/.test(name)) return false;

  // Reject too short names
  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0].length < 3) return false;

  return true;
}
  
  // Function to scrape names, titles, and emails from a given page
  async function scrapePeopleFromPage(pageUrl, browser) {
    const peopleFound = [];
    const maxRetries = 3;
    let pageInstance; // Declare pageInstance here

    try {
      pageInstance = await browser.newPage(); // Create a new page for this function call
      await pageInstance.setRequestInterception(true);

      pageInstance.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add a random delay before navigating to the page
          // const delay = Math.floor(Math.random() * 3000) + 2000; // Random delay between 2 to 5 seconds
          // await new Promise(resolve => setTimeout(resolve, delay));

          try {
            await pageInstance.goto(pageUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 60000
            });
          } catch (err) {
            console.log(`Skipping slow page: ${pageUrl}, continuing anyway...`);
            return [];
          }
          const content = await pageInstance.content();

          // More aggressive approach: look for common HTML structures and patterns
          const scrapedElements = await pageInstance.$$eval('div[class*="team-member"], div[class*="person-card"], div[class*="staff-profile"], section[class*="team"], section[class*="people"], div[class*="name"], div[class*="person"], div[class*="member"], div[class*="contact"], a[href*="mailto:"], h1, h2, h3, h4, h5, h6, p, li, span', (elements, irrelevantPhrases) => {
            const results = [];
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

            // Define isValidNameInBrowser locally for the browser context
            const isValidNameInBrowser = (name, title, irrelevantPhrases) => {
              if (!name || typeof name !== 'string' || name.trim().length < 3) { // Increased minimum length to 3
                return false;
              }

              const lowerName = name.toLowerCase().trim();
              const lowerTitle = (title || '').toLowerCase().trim();
              const words = name.split(/\s+/).filter(Boolean);

              // Consolidate all irrelevant terms
              const commonTitles = [
                'ceo', 'cto', 'cfo', 'cmo', 'cio', 'hr', 'sales', 'marketing', 'support', 'admin', 'manager', 'director',
                'president', 'founder', 'owner', 'partner', 'head', 'lead', 'vice', 'executive', 'staff', 'team',
                'contact', 'about', 'home', 'blog', 'news', 'events', 'careers', 'jobs', 'privacy', 'terms', 'legal',
                'investors', 'media', 'press', 'solutions', 'products', 'services', 'company', 'group', 'inc', 'ltd',
                'corp', 'llc', 'gmbh', 'ag', 'sa', 'bv', 'pte', 'sarl', 'dr', 'mr', 'ms', 'jr', 'sr', 'prof', 'eng',
                'phd', 'm.d.', 'm.d', 'esq', 'cpa', 'cfa', 'p.e.', 'p.e', 'access', 'management', 'consulting',
                // Expanded generic terms
                'info', 'hello', 'admin', 'support', 'sales', 'marketing', 'enquiries', 'inquiries', 'billing', 'careers',
                'jobs', 'press', 'media', 'legal', 'privacy', 'terms', 'abuse', '', 'noreply', 'postmaster',
                'security', 'feedback', 'help', 'office', 'reception', 'frontdesk', 'customerservice', 'customercare',
                'accounts', 'finance', 'purchasing', 'hr', 'humanresources', 'it', 'tech', 'development', 'design',
                'operations', 'pr', 'publicrelations', 'investorrelations', 'partnerships', 'affiliates', 'events',
                'newsletter', 'subscribe', 'unsubscribe', 'notifications', 'updates', 'system', 'daemon', 'hostmaster',
                'root', 'guest', 'test', 'demo', 'trial', 'info@', 'hello@', 'admin@', 'support@', 'sales@', 'marketing@',
                'contact@', 'enquiries@', 'inquiries@', 'billing@', 'careers@', 'jobs@', 'press@', 'media@', 'legal@',
                'privacy@', 'terms@', 'abuse@', '@', 'noreply@', 'postmaster@', 'security@', 'feedback@', 'help@',
                'office@', 'reception@', 'frontdesk@', 'customerservice@', 'customercare@', 'accounts@', 'finance@',
                'purchasing@', 'hr@', 'humanresources@', 'it@', 'tech@', 'development@', 'design@', 'operations@', 'pr@',
                'publicrelations@', 'investorrelations@', 'partnerships@', 'affiliates@', 'events@', 'newsletter@',
                'subscribe@', 'unsubscribe@', 'notifications@', 'updates@', 'system@', 'daemon@', 'hostmaster@', 'root@',
                'guest@', 'test@', 'demo@', 'trial@', 'mail', 'email', 'website', 'domain', 'server', 'client', 'user',
                'account', 'team', 'group', 'department', 'division', 'section', 'unit', 'branch', 'office', 'headquarters',
                'corporate', 'global', 'international', 'national', 'regional', 'local', 'general', 'main', 'primary',
                'secondary', 'tertiary', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
                'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth',
                'eighteenth', 'nineteenth', 'twentieth', 'twentyfirst', 'twentysecond', 'twentythird', 'twentyfourth',
                'twentyfifth', 'twentysixth', 'twentyseventh', 'twentyeighth', 'twentyninth', 'thirtieth', 'thirtyfirst',
                'thirtysecond', 'thirtythird', 'thirtyfourth', 'thirtyfifth', 'thirtysixth', 'thirtyseventh', 'thirtyeighth',
                'thirtyninth', 'fortieth', 'fortyfirst', 'fortysecond', 'fortythird', 'fortyfourth', 'fortyfifth',
                'fortysixth', 'fortyseventh', 'fortyeighth', 'fortyninth', 'fiftieth', 'fiftyfirst', 'fiftysecond',
                'fiftythird', 'fiftyfourth', 'fiftyfifth', 'fiftysixth', 'fiftyseventh', 'fiftyeighth', 'fiftyninth',
                'sixtieth', 'sixtyfirst', 'sixtysecond', 'sixtythird', 'sixtyfourth', 'sixtyfifth', 'sixtysixth',
                'sixtyseventh', 'sixtyeighth', 'sixtyninth', 'seventieth', 'seventyfirst', 'seventysecond', 'seventythird',
                'seventyfourth', 'seventyfifth', 'seventysixth', 'seventyseventh', 'seventyeighth', 'seventyninth',
                'eightieth', 'eightyfirst', 'eightysecond', 'eightythird', 'eightyfourth', 'eightyfifth', 'eightysixth',
                'eightyseventh', 'eightyeighth', 'eightyninth', 'ninetieth', 'ninetyfirst', 'ninetysecond', 'ninetythird',
                'ninetyfourth', 'ninetyfifth', 'ninetysixth', 'ninetyseventh', 'ninetyeighth', 'ninetyninth', 'hundredth'
              ];
              const allIrrelevantTerms = new Set([...irrelevantPhrases.map(p => p.toLowerCase()), ...commonTitles]);

              // Check against all irrelevant terms
              if (Array.from(allIrrelevantTerms).some(phrase => lowerName.includes(phrase) || lowerTitle.includes(phrase))) {
                return false;
              }

              // Exclude names that are all uppercase and short (likely acronyms or company names)
              if (name === name.toUpperCase() && name.length <= 5 && words.length === 1) {
                return false;
              }

              // Refined single-word validation:
              // If it's a single word, it should be a proper noun (starts with capital, rest lowercase)
              // and not be in the irrelevant terms list.
              if (words.length === 1) {
                const singleWord = words[0];
                if (!/^[A-Z][a-z]+$/.test(singleWord) || allIrrelevantTerms.has(singleWord.toLowerCase())) {
                  return false;
                }
              }

              // Check for presence of numbers or too many special characters in the name
              // Allow apostrophes and hyphens, but limit other special characters
              if (/\d/.test(name) || (name.match(/[^a-zA-Z\s'-]/g) || []).length > 1) {
                return false;
              }

              // Exclude very short names that are likely not full names (e.g., "Dr", "Mr", "CEO")
              if (words.length === 1 && name.length <= 3) {
                  return false;
              }

              // Ensure names have at least two distinct parts (first and last name) unless it's a known single name
              // This helps filter out single words that might be company names or generic terms
              // Relaxed this slightly to allow for valid single names that pass other checks
              if (words.length < 2 && name.length > 3 && !/^[A-Z][a-z]+$/.test(name)) {
                  return false;
              }

              // Check for names that are too long (unlikely to be a single person's name)
              if (name.length > 30) { // Reduced max length to 30
                  return false;
              }

              // Exclude names that are just a sequence of capital letters (e.g., "ABC Company")
              if (name === name.toUpperCase() && name.length > 1 && words.length === 1) {
                  return false;
              }

              // New check: Names should typically start with a capital letter
              if (words.length > 0 && !/^[A-Z]/.test(words[0])) {
                  return false;
              }

              // New check: Avoid names that are just initials unless they are part of a longer name (e.g., "J D" is okay, but "J" is not)
              if (words.every(word => word.length === 1 && /^[A-Z]$/.test(word)) && words.length < 2) {
                  return false;
              }

              // New check: Filter out names with too many words (e.g., more than 6)
              if (words.length > 6) { // Reduced max words to 6
                  return false;
              }

              // NEW: Check if all words (except possibly very short ones like 'de', 'van') start with a capital letter
              // This helps filter out phrases like "our sales team" or "contact us for support"
              for (const word of words) {
                if (word.length > 2 && !/^[A-Z]/.test(word)) { // Allow short words like 'de' or 'van' to be lowercase
                  return false;
                }
              }

              return true;
            };

            // Helper function to parse full name into first and last name
            const parseFullName = (fullName) => {
              const prefixes = ['dr', 'mr', 'ms', 'mrs', 'prof', 'rev', 'fr', 'sir', 'madam'];
              const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'esq', 'cpa'];

              let nameParts = fullName.split(/\s+/).filter(Boolean);
              let firstName = '';
              let lastName = '';

              // Remove prefixes
              if (nameParts.length > 0 && prefixes.includes(nameParts[0].toLowerCase())) {
                nameParts.shift();
              }

              // Remove suffixes (from the end)
              while (nameParts.length > 0 && suffixes.includes(nameParts[nameParts.length - 1].toLowerCase())) {
                nameParts.pop();
              }

              if (nameParts.length === 1) {
                firstName = nameParts[0];
              } else if (nameParts.length > 1) {
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join(' ');
              }

              return { first_name: firstName, last_name: lastName };
            };

            elements.forEach(el => {
              if (el.innerText && el.innerText.length > 5 && el.innerText.length < 500) {
                const text = el.innerText.trim();
                const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                let name = '';
                let title = '';
                let email = '';

                // Find email in the text
                const emailMatch = text.match(emailRegex);
                if (emailMatch) {
                  email = emailMatch[0];

                  // Try different patterns to extract name and title
                  // Prioritize mailto links
                  if (el.tagName === 'A' && el.href.startsWith('mailto:')) {
                    name = el.innerText.replace(emailRegex, '').replace(/[<>\(\)\-]/g, '').trim();
                    if (!name) {
                      const mailtoNameMatch = el.href.match(/mailto:([^?]+)/);
                      if (mailtoNameMatch && mailtoNameMatch[1]) {
                        name = mailtoNameMatch[1].split('@')[0].replace(/[\._]/g, ' ').trim();
                      }
                    }
                  }

                  if (!name && lines.length >= 2) {
                    const line1 = lines[0];
                    const line2 = lines[1];

                    const nameLikeRegex = /^[A-Z][a-zA-Z\s.'-]+$/;
                    const titleLikeRegex = /^(Manager|Director|Engineer|Specialist|Lead|Head|Officer|VP|President|Founder|CEO|CTO|CFO|CMO|CIO|COO|HR|Sales|Marketing|Software|Data|Product|Project|Business|Senior|Junior|Associate|Analyst|Consultant|Developer|Designer|Architect|Scientist|Research|Operations|Customer|Support|Client|Account|Finance|Legal|Admin|Executive|Assistant|Coordinator|Specialist|Representative|Recruiter|Talent|People|Office|Facilities|Event|Public Relations|Social Media|Content|Writer|Photographer|Videographer|Graphic|Web|Investment|Portfolio|Wealth|Financial|Insurance|Real Estate|Broker|Trader|Underwriter|Claims|Actuary|Co-founder|Chief of Staff|General Manager|Program Manager|Regional Director|Area Director|Country Director|Global Director|Section Head|Group Leader|Team Leader|Supervisor|Foreman|Student|Volunteer)\b/i;

                    if (nameLikeRegex.test(line1) && titleLikeRegex.test(line2)) {
                      name = line1;
                      title = line2;
                    } else if (nameLikeRegex.test(line2) && titleLikeRegex.test(line1)) {
                      name = line2;
                      title = line1;
                    } else if (!emailRegex.test(line1) && line1.length > 3 && line1.split(' ').length <= 4) {
                      name = line1;
                      if (!emailRegex.test(line2) && line2.length > 3 && line2.split(' ').length <= 5) {
                         title = line2;
                      }
                    }
                  }

                  if (!name && lines.length === 1) {
                    name = lines[0].replace(emailRegex, '').replace(/[<>\(\)\-]/g, '').trim();
                  }

                  // Fallback: try to extract name from email if not found yet
                  if (!name && email) {
                    const emailUser = email.split('@')[0];
                    const emailParts = emailUser.split(/[\._-]/); // Split by '.', '_', or '-'
                    if (emailParts.length >= 2) {
                      name = emailParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
                    } else if (emailParts.length === 1) {
                      name = emailParts[0].replace(/[\d]/g, '').trim(); // Remove numbers
                      if (name.length > 1 && name.length < 20) {
                         name = name.charAt(0).toUpperCase() + name.slice(1);
                      } else {
                         name = '';
                      }
                    }
                  }

                  // Clean up name and title
                  if (name) name = name.replace(/[^a-zA-Z\s.'-]+/g, '').trim();
                  if (title) title = title.replace(/[^a-zA-Z\s.'-]+/g, '').trim();

                  // Additional patterns for name-email combinations
                  const patterns = [
                    /([A-Za-z\s]+)\s*<[^>]*>/g, // Name <...>
                    /\([^)]+\)\s*([A-Za-z\s]+)/g, // (...) Name
                    /([A-Za-z\s]+)\s*-\s*[^@]+@/g, // Name - ...@
                  ];
                  patterns.forEach(pattern => {
                    const match = text.match(pattern);
                    if (match) {
                      const extracted = match[0].replace(emailRegex, '').replace(/[<>\(\)\-]/g, '').trim();
                      if (extracted && !name) name = extracted;
                    }
                  });

                  // Validate and add
                  if (isValidNameInBrowser(name, title, irrelevantPhrases)) {
                    const { first_name, last_name } = parseFullName(name);
                    results.push({ name, first_name, last_name, title, email });
                  }
                }
              }
            });

            // Additional global search for specific patterns across the page
            const bodyText = document.body.innerText;
            const globalPatterns = [
              /([A-Za-z\s]+)\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/g, // Name <email>
              /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*\(([^)]+)\)/g, // email (name)
              /([A-Za-z\s]+)\s*-\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, // Name - email
            ];
            globalPatterns.forEach(pattern => {
              let match;
              while ((match = pattern.exec(bodyText)) !== null) {
                const name = match[1] || match[2];
                const email = match[2] || match[1];
                if (name && email && isValidNameInBrowser(name, '', irrelevantPhrases)) {
                  const { first_name, last_name } = parseFullName(name);
                results.push({ name, first_name, last_name, title: '', email });
                }
              }
            });

            return results;
          }, CONFIG.irrelevantPhrases);

          scrapedElements.forEach(person => {
            if (person.name && person.email) {
              peopleFound.push(person);
            }
          });
          return peopleFound; // Success, return the results
        } catch (error) {
          console.error(`Error scraping people from ${pageUrl} (attempt ${attempt}/${maxRetries}):`, error.message);
          if (attempt === maxRetries) {
            return []; // Return empty array after all retries
          }
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    } finally {
      if (pageInstance && !pageInstance.isClosed()) {
        await pageInstance.close(); // Ensure the page is closed
      }
    }
    return peopleFound; // Return peopleFound outside the try-finally
  }

  // Visit potential people pages and scrape concurrently
  const peoplePageUrlsToScrape = Array.from(potentialPeoplePages).filter(url => !visited.has(url));
  const limit = CONFIG.peoplePageConcurrency;
  let activePromises = 0;
  let urlIndex = 0;

  while (urlIndex < peoplePageUrlsToScrape.length || activePromises > 0) {
    while (activePromises < limit && urlIndex < peoplePageUrlsToScrape.length) {
      const peoplePageUrl = peoplePageUrlsToScrape[urlIndex++];
      if (scrapedPeople.length >= CONFIG.maxPeopleToScrape) {
        console.log(`Reached max people to scrape (${CONFIG.maxPeopleToScrape}). Stopping.`);
        break;
      }

      console.log(`[INFO] Visiting potential people page: ${peoplePageUrl}`);
      const promise = scrapePeopleFromPage(peoplePageUrl, browser)
        .then(peopleOnPage => {
          peopleOnPage.forEach(person => {
            if (scrapedPeople.length < CONFIG.maxPeopleToScrape) {
              scrapedPeople.push(person);
              scrapedEmails.add(person.email);
            }
          });
        })
        .catch(error => {
          console.error(`Error scraping people from ${peoplePageUrl} in concurrent task:`, error);
        })
        .finally(() => {
          activePromises--;
        });
      activePromises++;
    }
    // Wait for at least one promise to settle if there are active promises
    if (activePromises > 0) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to prevent busy-waiting
    }
    if (scrapedPeople.length >= CONFIG.maxPeopleToScrape) {
      break;
    }
  }
  

  // Apply "Least Position" Logic to Scraped Data
  if (scrapedPeople.length > 0) {
    // Sort people by job title score in ascending order (least position first)
    scrapedPeople.sort((a, b) => getJobTitleScore(a.title) - getJobTitleScore(b.title));

    // Select the person with the least position as the sender
    sender = {
      first_name: scrapedPeople[0].first_name || 'Team',
      last_name: scrapedPeople[0].last_name || 'Member',
      email: scrapedPeople[0].email,
      title: scrapedPeople[0].title
    };
    console.log(`[INFO] Selected sender: ${sender.first_name} ${sender.last_name} (${sender.title}) - ${sender.email}`);
  } else {
    // Fallback: if no specific people were scraped, set sender to null
    sender = null;
    console.log(`[INFO] No specific people scraped. Setting sender to null.`);
  }

  // After scraping, if emails or phone numbers are found, emit a new-lead event
  if (scrapedEmails.size > 0 || scrapedPhoneNumbers.size > 0) {
    const newLead = {
      website: url,
      companyName: companyName,
      emails: Array.from(scrapedEmails),
      phoneNumbers: Array.from(scrapedPhoneNumbers),
      scrapedPeople: scrapedPeople,
      sender: sender,
      apolloContacts: apolloContacts,
      timestamp: new Date().toISOString()
    };

    // Load existing leads, add the new one, and save
    const allLeads = await loadLeads();
    allLeads.unshift(newLead); // Add to the beginning to show up first
    await saveLeads(allLeads);

    io.emit('new-lead', newLead);
    console.log(`Emitted new-lead event for ${url}`);
  }

  return {
    emails: Array.from(scrapedEmails),
    phoneNumbers: Array.from(scrapedPhoneNumbers),
    domain: initialHost,
    companyName,
    scrapedPeople,
    sender,
    apolloContacts
  };
 
  // Add this line at the very end of the function
  if (page && !page.isClosed()) {
    await page.close();

}

}



// ---------- MAIN BOT ----------
async function main(io, loadLeads, saveLeads) {


  const shuffledIndustries = shuffleArray([...CONFIG.industries]);

  let browser = await puppeteer.launch({
    headless: "new",
    ignoreHTTPSErrors: true, // Add this line
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list',
      '--ignore-ssl-errors-ignore-untrusted',
      '--disable-blink-features=AutomationControlled'
    ],
    protocolTimeout: 90000, // Increase timeout for stealth plugin
  });



  while (true) {
    try {
      const leads = loadLeads();
      console.log(`Loaded ${leads.length} existing leads.`);

      const industries = shuffledIndustries;
      const countryCodesForSearch = CONFIG.manualCountryCodesForSearch;

      // Ensure indices are within bounds
      if (currentIndustryIndex >= industries.length) {
        currentIndustryIndex = 0; // Reset industries
      }

      const industry = industries[currentIndustryIndex];
      console.log(`\nSearching websites for industry: ${industry}`);

      const processedCountryCodes = [];
      const allWebsitesForCurrentBatch = [];
      for (let i = 0; i < COUNTRY_CODE_BATCH_SIZE; i++) {
        if (currentCountryCodeIndex >= countryCodesForSearch.length) {
          currentCountryCodeIndex = 0; // Reset country codes for the next industry cycle
          break; // Exit batching if all country codes are processed for this industry cycle
        }
        processedCountryCodes.push(countryCodesForSearch[currentCountryCodeIndex]);
        currentCountryCodeIndex++;
      }

      if (processedCountryCodes.length === 0) {
        // If no country codes were processed in this batch, move to the next industry
        currentIndustryIndex++;
        console.log(`No country codes processed in this batch for industry ${industry}. Moving to next industry.`);
        await wait(DELAY_BETWEEN_BATCHES_MS); // Wait before moving to the next industry
        continue;
      }

      for (const countryCode of processedCountryCodes) {
        console.log(`[INFO] Searching for industry: ${industry} in country: ${countryCode || 'Global'}`);

        let dialingCodeToUse = CONFIG.defaultDialingCode;
        if (!dialingCodeToUse && countryCode && CONFIG.countryDialingCodeMapping[countryCode]) {
          dialingCodeToUse = CONFIG.countryDialingCodeMapping[countryCode];
        }
        const websites = await getWebsitesByIndustry(industry, browser, countryCode, dialingCodeToUse);
        console.log(`Found ${websites.length} websites for industry ${industry} in country ${countryCode}.`);
        allWebsitesForCurrentBatch.push(...websites.map(w => ({ website: w, dialingCode: dialingCodeToUse })));
      }

      // Remove duplicates from allWebsitesForCurrentBatch
      const uniqueWebsitesForCurrentBatch = [];
      const seenWebsites = new Set();
      for (const item of allWebsitesForCurrentBatch) {
        if (!seenWebsites.has(item.website)) {
          seenWebsites.add(item.website);
          uniqueWebsitesForCurrentBatch.push(item);
        }
      }
      console.log(`Total unique websites found for industry ${industry} in this batch: ${uniqueWebsitesForCurrentBatch.length}`);

      for (const { website, dialingCode } of uniqueWebsitesForCurrentBatch) {
        if (leads.some(l => l.website === website)) {
          console.log(`Skipping already processed website: ${website}`);
          continue;
        }

        const { emails, phoneNumbers, domain, companyName, scrapedPeople, sender, apolloContacts } = await extractEmailsFromWebsite(website, browser, io, loadLeads, saveLeads, dialingCode);
        // A lead is valid if we found any emails (scraped or Apollo) or Apollo contacts
        if (emails.length > 0 || phoneNumbers.length > 0 || scrapedPeople.length > 0) {
          const lead = {
            website,
            domain, // Store the extracted domain
            companyName, // Store the extracted company name
            emails, // Emails found via scraping and Apollo (excluding sender)
            phoneNumbers, // Phone numbers found via scraping
            scrapedPeople, // All relevant Apollo contacts
            sender, // The selected sender contact from Apollo
            industry,
            timestamp: new Date().toISOString(),

          };
          leads.unshift(lead);
          saveLeads(leads);
          console.log(`Saved new lead for ${website}. Total leads: ${leads.length}`); // Added log
          io.emit('new-lead', lead);
        } else {
          console.log(`No emails found for ${website}.`); // Added log
        }
      }

      // After processing a batch of country codes for the current industry, wait
      console.log(`Finished batch for industry: ${industry}. Waiting for ${DELAY_BETWEEN_BATCHES_MS / 1000} seconds before next batch/industry.`);
      await wait(DELAY_BETWEEN_BATCHES_MS);

      // If all country codes for the current industry have been processed, move to the next industry
      if (currentCountryCodeIndex >= countryCodesForSearch.length) {
        console.log(`[INFO] Industry ${industry} completed. Relaunching browser for next industry.`);
        if (browser) {
          await browser.close();
        }
        browser = await puppeteer.launch({
          headless: "new",
          ignoreHTTPSErrors: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--ignore-ssl-errors-ignore-untrusted',
            '--disable-blink-features=AutomationControlled'
          ],
          protocolTimeout: 90000,
        });
        currentIndustryIndex++;
        currentCountryCodeIndex = 0; // Reset country code index for the new industry
      }


      console.log('\nFinished scraping all industries. Restarting in a bit...');
      if (io) { // Only emit if io is defined
        io.emit('bot-status', { message: 'Finished scraping all industries. Restarting in a bit...' });
      }
      await wait(10000);
    } catch (error) {
      console.error('A critical error occurred in the main loop:', error);
      if (io) { // Only emit if io is defined
        io.emit('bot-error', { message: error.message });
      }
      if (browser) await browser.close();
      console.log('Restarting browser and continuing...');
      browser = await puppeteer.launch({
        headless: "new", // Changed to "new" as per deprecation warning
        ignoreHTTPSErrors: true, // Add this line
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list',
          '--ignore-ssl-errors-ignore-untrusted',
          '--disable-blink-features=AutomationControlled'

          
        ],
        protocolTimeout: 90000, // Increase timeout for stealth plugin
      });
    }
  }
  }

  
module.exports = { main };

if (require.main === module) {
  main();
}