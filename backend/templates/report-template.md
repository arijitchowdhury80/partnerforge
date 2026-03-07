# Search Audit Report: {{company_name}}

**Generated**: {{generated_at}}
**Audit ID**: {{audit_id}}
**Search Experience Score**: {{overall_score}}/10

---

## Executive Summary

**Search Experience Score**: {{overall_score}}/10

**Key Findings**:
{{#each top_findings}}
- {{this.finding}} ({{this.severity}})
{{/each}}

**Opportunity**: Estimated {{roi.annual_revenue}} in additional revenue with optimized search.

{{score_interpretation}}

---

## Company Snapshot

**Industry**: {{company.industry}}
**Revenue**: [{{financials.revenue}}]({{financials.source_url}})
**Monthly Visits**: [{{traffic.monthly_visits}}]({{traffic.source_url}})
**Tech Stack**:
- E-commerce Platform: {{tech_stack.ecommerce}}
- Current Search Provider: {{tech_stack.search_provider}}
- CMS: {{tech_stack.cms}}

**Market Position**: {{company.market_position}}

---

## Strategic Intelligence

### Why Now?

{{#if trigger_events}}
{{#each trigger_events}}
- **{{this.type}}**: {{this.description}}
{{/each}}
{{else}}
No significant trigger events identified.
{{/if}}

### Recent Executive Insights

{{#if executive_quotes}}
{{#each executive_quotes}}
> "{{this.quote}}"
> — {{this.speaker}}, {{this.title}}, [{{this.source}}]({{this.source_url}}), {{this.date}}

{{/each}}
{{else}}
No recent executive quotes available.
{{/if}}

### Intent Signals

{{#if intent_signals}}
{{#each intent_signals}}
- {{this.signal_type}}: {{this.signal_description}}
{{/each}}
{{else}}
No intent signals detected.
{{/if}}

---

## In Their Own Words

{{#if quote_mappings}}
{{#each quote_mappings}}
> "{{this.quote.quote}}"
> — {{this.quote.speaker}}, {{this.quote.title}}, [{{this.quote.source}}]({{this.quote.source_url}}), {{this.quote.date}}

**What we found**: {{this.finding.finding}}

**Algolia solution**: {{this.algolia_product}} can {{this.business_impact}}

---

{{/each}}
{{else}}
_No executive quotes matched to audit findings._
{{/if}}

---

## Findings

{{#if findings}}
{{#each findings}}
### {{@index}}. {{this.finding}} ({{this.severity}})

**Test**: {{this.test_name}} ({{this.test_id}})
**Evidence**: {{this.evidence}}

{{#if this.screenshot_path}}
![Screenshot]({{this.screenshot_path}})
{{else}}
_No screenshot available._
{{/if}}

**Business Impact**: {{this.business_impact}}

---

{{/each}}
{{else}}
_No findings to report._
{{/if}}

---

## Competitor Landscape

{{#if competitors}}
{{#each competitors}}
### {{this.competitor_name}}

- **Domain**: [{{this.competitor_domain}}](https://{{this.competitor_domain}})
- **Category**: {{this.category}}
- **Affinity Score**: {{this.affinity_score}}
- **Search Provider**: {{this.search_provider}}

{{/each}}
{{else}}
_No competitor data available._
{{/if}}

---

## Opportunities

{{#each opportunities}}
### {{this.title}}

{{this.description}}

**Algolia Solution**: {{this.algolia_product}}
**Expected Impact**: {{this.expected_impact}}

---

{{/each}}

---

## ROI Estimate

### Revenue Funnel Impact

- **Current Annual Revenue**: {{roi.current_revenue}}
- **Estimated Uplift**: {{roi.estimated_uplift}}%
- **Additional Revenue**: {{roi.annual_revenue}}

### 3-Year Projection

| Year | Revenue Impact | Cumulative |
|------|----------------|------------|
| Year 1 | {{roi.year1}} | {{roi.year1}} |
| Year 2 | {{roi.year2}} | {{roi.cumulative2}} |
| Year 3 | {{roi.year3}} | {{roi.cumulative3}} |

**Assumptions**:
{{#each roi.assumptions}}
- {{this}}
{{/each}}

---

## ICP Mapping

### Which Personas Care About Which Findings

{{#if icp_mappings}}
{{#each icp_mappings}}
#### {{this.persona}}

**Cares about**: {{this.findings}}

**Why**: {{this.reason}}

**Sales Angle**: {{this.angle}}

{{/each}}
{{else}}
_No ICP mappings available._
{{/if}}

---

## Bibliography

All data points in this report are sourced and hyperlinked. Sources include:
- [SimilarWeb](https://www.similarweb.com) - Traffic & engagement data
- [BuiltWith](https://builtwith.com) - Technology stack
- [Yahoo Finance](https://finance.yahoo.com) - Financial data
- [SEC Edgar](https://www.sec.gov/edgar) - 10-K, 10-Q filings
- Company website - Screenshots, product catalog

---

**Prepared by**: Arian Platform
**Report Version**: 1.0
**Last Updated**: {{generated_at}}
