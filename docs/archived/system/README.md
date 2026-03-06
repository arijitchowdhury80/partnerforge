# System Documentation

**Last Updated:** March 6, 2026
**Status:** Operational documentation for development team

---

## Purpose

This directory contains operational documentation for developers:
- Enrichment processes
- Security audit findings
- UX audit recommendations
- Documentation standards

**For comprehensive architecture, see:** [docs/architecture/ARCHITECTURE_MASTER.md](../architecture/ARCHITECTURE_MASTER.md)

---

## Current Files

### Operational Documentation

| File | Purpose | Status |
|------|---------|--------|
| **ENRICHMENT_TASK_PARTNER_TECH.md** | Partner technology enrichment process (BuiltWith) | ✅ Current |
| **DOCUMENTATION_RULES.md** | Internal documentation standards | ✅ Current |

### Security & Compliance

| File | Purpose | Status |
|------|---------|--------|
| **SECURITY_REMEDIATION_PLAN.md** | Security audit findings and remediation roadmap | ⚠️ See note below |
| **SECURITY_VERIFICATION_REPORT.md** | Security verification test results (Feb 26, 2026) | ✅ Audit trail |

### UX & Design

| File | Purpose | Status |
|------|---------|--------|
| **UX-AUDIT-REPORT.md** | UX audit findings and recommendations (Feb 28, 2026) | ✅ Reference |

---

## Important Notes

### Security Architecture
**SECURITY_REMEDIATION_PLAN.md** was created on Feb 26, 2026 and references the old architecture.

**For current security architecture, see:**
- [docs/architecture/ARCHITECTURE_MASTER.md](../architecture/ARCHITECTURE_MASTER.md) - Section 4 (Security Architecture)
- [docs/operations/CODE_STANDARDS.md](../operations/CODE_STANDARDS.md) - Security standards

**Week 1 Security Priorities:**
1. Move API keys to Supabase Edge Functions (server-side)
2. Configure Google OAuth SSO (restricted to @algolia.com)
3. Set up Redis with 7-day TTL
4. Implement role-based access (admin/user/viewer)

---

## Files Moved to Historical

The following files have been moved to [docs/historical/](../historical/) as they were superseded by comprehensive architecture documentation created March 6, 2026:

| File | Moved To | Reason |
|------|----------|--------|
| MEMORY.md | historical/MEMORY_OLD_FEB26.md | Superseded by ARCHITECTURE_MASTER.md |
| ARCHITECTURE.md | historical/ARCHITECTURE_OLD_V5.md | Superseded by ARCHITECTURE_MASTER.md |
| PRD.md | historical/PRD_V5.2_FEB27.md | Play concepts in sales-system/PLAY-SYSTEM.md |
| PROJECT_TRACKER.md | historical/PROJECT_TRACKER_FEB26.md | Stats outdated, roadmap in ARCHITECTURE_MASTER.md |
| DEPLOYMENT.md | historical/DEPLOYMENT_OLD_FEB28.md | Deployment changed with new architecture |

---

## Comprehensive Documentation

For complete project documentation, see:

### Architecture & Operations
- [docs/architecture/ARCHITECTURE_MASTER.md](../architecture/ARCHITECTURE_MASTER.md) - Complete architecture decisions (45 KB, 10 sections)
- [docs/operations/EXECUTIVE_SUMMARY.md](../operations/EXECUTIVE_SUMMARY.md) - Budget approval ($1,279 request)
- [docs/operations/CODE_STANDARDS.md](../operations/CODE_STANDARDS.md) - 23 Golden Rules (NON-NEGOTIABLE)
- [docs/operations/COST_ANALYSIS_1000_AUDITS.md](../operations/COST_ANALYSIS_1000_AUDITS.md) - Detailed cost breakdown

### ICP & Sales
- [docs/icp-analysis/](../icp-analysis/) - ICP definitions, scoring, cohort analysis (5 files)
- [docs/sales-system/](../sales-system/) - Sales machinery, funnels, play system (3 files)

### Master Index
- [docs/README.md](../README.md) - Complete documentation index with navigation

---

**Internal Use Only** - This directory is for development team only. Sales and PAM users should refer to the main [docs/README.md](../README.md).
