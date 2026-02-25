/**
 * PartnerForge API Client
 *
 * JavaScript client for the FastAPI backend.
 * Include this file in index.html to enable API integration.
 */

// ===== API Configuration =====
const API_BASE_URL = 'http://localhost:8000';
let currentTargetDomain = null;

// ===== API Helper Functions =====

/**
 * Fetch company data from the API
 */
async function fetchCompanyFromAPI(domain) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/company/${domain}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Company ${domain} not found in API`);
                return null;
            }
            throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        return data.company;
    } catch (error) {
        console.error('API fetch error:', error);
        return null;
    }
}

/**
 * Trigger enrichment for a company
 */
async function enrichCompanyFromAPI(domain, force = false) {
    try {
        const url = `${API_BASE_URL}/api/enrich/${domain}${force ? '?force=true' : ''}`;
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API enrichment error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Loading company data...') {
    const overlay = document.getElementById('detailLoadingOverlay');
    const textEl = document.getElementById('loadingText');
    if (overlay && textEl) {
        textEl.textContent = message;
        overlay.classList.remove('hidden');
    }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('detailLoadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

/**
 * Update enrichment status badge
 */
function updateEnrichmentStatus(lastEnriched, enrichmentLevel) {
    const statusEl = document.getElementById('enrichmentStatus');
    if (!statusEl) return;

    if (enrichmentLevel === 'full' && lastEnriched) {
        const enrichedDate = new Date(lastEnriched);
        const daysSince = Math.floor((new Date() - enrichedDate) / (1000 * 60 * 60 * 24));

        if (daysSince < 7) {
            statusEl.textContent = 'Data fresh';
            statusEl.className = 'enrichment-status fresh';
        } else {
            statusEl.textContent = `Updated ${daysSince}d ago`;
            statusEl.className = 'enrichment-status stale';
        }
    } else {
        statusEl.textContent = 'Not enriched';
        statusEl.className = 'enrichment-status never';
    }
}

/**
 * Refresh company data by calling the enrichment API
 */
async function refreshCompanyData() {
    if (!currentTargetDomain) return;

    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
    }

    showLoading('Enriching company data from APIs...');

    try {
        const result = await enrichCompanyFromAPI(currentTargetDomain, true);

        if (result.success && result.result && result.result.company) {
            // Update the detail view with fresh data
            updateDetailViewWithAPIData(result.result.company);
            hideLoading();
        } else if (result.cached) {
            hideLoading();
            alert('Data is already fresh (cached). No update needed.');
        } else {
            hideLoading();
            const errors = result.errors ? result.errors.join(', ') : 'Unknown error';
            alert(`Enrichment partially completed. Errors: ${errors}`);
            // Still try to refresh the view
            const company = await fetchCompanyFromAPI(currentTargetDomain);
            if (company) {
                updateDetailViewWithAPIData(company);
            }
        }
    } catch (error) {
        hideLoading();
        console.error('Refresh error:', error);
        alert('Failed to refresh data. Is the API server running at ' + API_BASE_URL + '?');
    } finally {
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }
    }
}

/**
 * Update detail view with data from API
 */
function updateDetailViewWithAPIData(apiData) {
    // Update enrichment status
    updateEnrichmentStatus(apiData.last_enriched, apiData.enrichment_level);

    // Update key metrics if available from API
    if (apiData.revenue) {
        const revenueFmt = formatCurrencyAPI(apiData.revenue);
        const el = document.getElementById('detailRevenue');
        if (el) el.textContent = revenueFmt;
    }
    if (apiData.gross_margin) {
        const el = document.getElementById('detailMargin');
        if (el) el.textContent = (apiData.gross_margin * 100).toFixed(1) + '%';
    }
    if (apiData.sw_monthly_visits) {
        const el = document.getElementById('detailTraffic');
        if (el) el.textContent = formatNumberAPI(apiData.sw_monthly_visits);
    }

    // Update tech stack if available
    if (apiData.tech_stack_json) {
        let techStack = apiData.tech_stack_json;
        if (typeof techStack === 'string') {
            try { techStack = JSON.parse(techStack); } catch(e) {}
        }
        if (Array.isArray(techStack) && techStack.length > 0) {
            const techGrid = document.getElementById('techStackGrid');
            if (techGrid) {
                techGrid.innerHTML = techStack.slice(0, 12).map(tech => `
                    <div class="tech-item">
                        <div class="category">${tech.category || 'Technology'}</div>
                        <div class="name">${tech.name}</div>
                    </div>
                `).join('');
            }
        }
    }

    // Update financials if available
    if (apiData.financials_json) {
        let fin = apiData.financials_json;
        if (typeof fin === 'string') {
            try { fin = JSON.parse(fin); } catch(e) {}
        }
        if (fin && typeof fin === 'object') {
            const fullIntel = document.getElementById('fullIntelContent');
            if (fullIntel && (fin.market_cap || fin.revenue || fin.employees)) {
                let finHTML = '<h4>Financial Details (Yahoo Finance)</h4><ul>';
                if (fin.market_cap) finHTML += `<li><strong>Market Cap:</strong> ${formatCurrencyAPI(fin.market_cap)}</li>`;
                if (fin.revenue) finHTML += `<li><strong>Revenue:</strong> ${formatCurrencyAPI(fin.revenue)}</li>`;
                if (fin.employees) finHTML += `<li><strong>Employees:</strong> ${fin.employees.toLocaleString()}</li>`;
                if (fin.sector) finHTML += `<li><strong>Sector:</strong> ${fin.sector}</li>`;
                if (fin.industry) finHTML += `<li><strong>Industry:</strong> ${fin.industry}</li>`;
                finHTML += '</ul>';
                fullIntel.innerHTML += finHTML;
            }
        }
    }
}

/**
 * Format currency value for display
 */
function formatCurrencyAPI(value) {
    if (!value) return '---';
    if (value >= 1e12) return '$' + (value / 1e12).toFixed(1) + 'T';
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(1) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
    return '$' + value.toFixed(0);
}

/**
 * Format number for display
 */
function formatNumberAPI(value) {
    if (!value) return '---';
    if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return value.toString();
}

/**
 * Hook into the existing openDetail function
 * Call this after the original openDetail completes
 */
function onDetailOpened(target) {
    currentTargetDomain = target.domain;

    // Update enrichment status from local data
    // (will be updated if we have enrichment info in target)
    if (target.lastEnriched || target.last_enriched) {
        updateEnrichmentStatus(target.lastEnriched || target.last_enriched, target.enrichmentLevel || target.enrichment_level || 'basic');
    } else {
        updateEnrichmentStatus(null, null);
    }
}

// Log that API client is loaded
console.log('PartnerForge API Client loaded. API endpoint:', API_BASE_URL);
