/**
 * Apollo.io API Client Usage Examples
 *
 * This file demonstrates how to use the ApolloClient to:
 * 1. Find buying committee members (executives)
 * 2. Identify intent signals (hiring velocity, tech changes, funding)
 * 3. Get comprehensive organization details
 *
 * @example Run this file: `tsx services/apollo.example.ts`
 */

import { ApolloClient } from './apollo';
import { logger } from '../utils/logger';

async function main() {
  const apollo = new ApolloClient();

  // Example 1: Find buying committee for Costco
  console.log('\n=== Example 1: Find Buying Committee ===\n');

  try {
    const executives = await apollo.searchPeople(
      'costco.com',
      [
        'CEO',
        'CFO',
        'CTO',
        'CIO',
        'Chief Information Officer',
        'VP Engineering',
        'VP Technology',
        'VP Product',
        'Director of Engineering',
        'Head of Engineering'
      ],
      25
    );

    console.log(`Found ${executives.data.people.length} decision makers at Costco:`);
    console.log('');

    executives.data.people.forEach((person) => {
      console.log(`👤 ${person.name}`);
      console.log(`   Title: ${person.title}`);
      console.log(`   Email: ${person.email || 'Not available'} (${person.email_status})`);

      if (person.phone_numbers && person.phone_numbers.length > 0) {
        const workPhone = person.phone_numbers.find((p) => p.type === 'work');
        if (workPhone) {
          console.log(`   Phone: ${workPhone.sanitized_number}`);
        }
      }

      console.log(`   LinkedIn: ${person.linkedin_url || 'Not available'}`);
      console.log(`   Location: ${person.city}, ${person.state}, ${person.country}`);
      console.log('');
    });

    console.log(`Cache hit: ${executives.meta.cached}`);
    console.log(`Latency: ${executives.meta.latency_ms}ms`);
  } catch (error) {
    logger.error('Failed to search people:', error);
  }

  // Example 2: Get intent signals for The RealReal
  console.log('\n=== Example 2: Intent Signals Analysis ===\n');

  try {
    const signals = await apollo.getIntentSignals('therealreal.com');
    const org = signals.data.organization;

    console.log(`Company: ${org.name}`);
    console.log(`Industry: ${org.industry}`);
    console.log(`Employees: ${org.estimated_num_employees.toLocaleString()}`);
    console.log(`Founded: ${org.founded_year}`);
    console.log(`Headquarters: ${org.city}, ${org.state}, ${org.country}`);
    console.log('');

    // Funding signals
    if (org.funding_events && org.funding_events.length > 0) {
      console.log('💰 Funding Events:');
      org.funding_events.forEach((event) => {
        console.log(`   - ${event.type}: ${event.amount} ${event.currency} (${event.date})`);
        if (event.investors) {
          console.log(`     Investors: ${event.investors}`);
        }
      });
      console.log('');
    }

    // Technology stack
    if (org.technology_names && org.technology_names.length > 0) {
      console.log('🔧 Technology Stack:');
      org.technology_names.slice(0, 10).forEach((tech) => {
        console.log(`   - ${tech}`);
      });
      console.log('');
    }

    // Department headcount growth (hiring velocity)
    if (org.departments && org.departments.length > 0) {
      console.log('📈 Department Growth (Hiring Velocity):');
      org.departments
        .filter((dept) => dept.headcount_growth_rate > 0)
        .sort((a, b) => b.headcount_growth_rate - a.headcount_growth_rate)
        .forEach((dept) => {
          console.log(
            `   - ${dept.name}: ${dept.headcount} employees (+${dept.headcount_growth_rate.toFixed(
              1
            )}% growth)`
          );
        });
      console.log('');
    }

    // Intent signals interpretation
    console.log('🎯 Intent Signals:');
    const intentSignals: string[] = [];

    // Hiring velocity signal
    const engineeringDept = org.departments?.find(
      (d) => d.name.toLowerCase().includes('engineering') || d.name.toLowerCase().includes('tech')
    );
    if (engineeringDept && engineeringDept.headcount_growth_rate > 10) {
      intentSignals.push(
        `HIGH: Rapid engineering hiring (+${engineeringDept.headcount_growth_rate.toFixed(
          1
        )}% growth) indicates expansion/tech overhaul`
      );
    }

    // Recent funding signal
    if (org.funding_events && org.funding_events.length > 0) {
      const recentFunding = org.funding_events[0];
      const fundingDate = new Date(recentFunding.date);
      const monthsAgo = Math.floor(
        (Date.now() - fundingDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      if (monthsAgo < 12) {
        intentSignals.push(
          `MEDIUM: Recent funding (${recentFunding.type} ${monthsAgo} months ago) = growth mode`
        );
      }
    }

    // Technology stack analysis
    const hasEcommercePlatform = org.technology_names?.some(
      (tech) =>
        tech.toLowerCase().includes('shopify') ||
        tech.toLowerCase().includes('magento') ||
        tech.toLowerCase().includes('commercetools')
    );
    if (hasEcommercePlatform) {
      intentSignals.push(
        'MEDIUM: Using e-commerce platform - likely needs better search & merchandising'
      );
    }

    if (intentSignals.length === 0) {
      console.log('   No strong intent signals detected');
    } else {
      intentSignals.forEach((signal) => {
        console.log(`   - ${signal}`);
      });
    }
    console.log('');

    console.log(`Cache hit: ${signals.meta.cached}`);
    console.log(`Latency: ${signals.meta.latency_ms}ms`);
  } catch (error) {
    logger.error('Failed to get intent signals:', error);
  }

  // Example 3: Get basic organization info
  console.log('\n=== Example 3: Organization Details ===\n');

  try {
    const orgResult = await apollo.getOrganization('autozone.com');
    const org = orgResult.data.organization;

    console.log(`Company: ${org.name}`);
    console.log(`Domain: ${org.domain}`);
    console.log(`Industry: ${org.industry}`);
    console.log(`Employees: ${org.estimated_num_employees?.toLocaleString() || 'Unknown'}`);
    console.log(`Revenue: ${org.annual_revenue_printed || 'Not disclosed'}`);
    console.log(`Public: ${org.publicly_traded_symbol || 'Private company'}`);
    console.log(`Location: ${org.city}, ${org.state}, ${org.country}`);
    console.log(`Founded: ${org.founded_year || 'Unknown'}`);
    console.log(`Phone: ${org.phone || 'Not available'}`);
    console.log(`LinkedIn: ${org.linkedin_url || 'Not available'}`);
    console.log('');

    if (org.technology_names && org.technology_names.length > 0) {
      console.log('Tech Stack Preview:');
      console.log(`   ${org.technology_names.slice(0, 5).join(', ')}...`);
      console.log(`   (${org.technology_names.length} total technologies)`);
    }
    console.log('');

    console.log(`Cache hit: ${orgResult.meta.cached}`);
    console.log(`Latency: ${orgResult.meta.latency_ms}ms`);
  } catch (error) {
    logger.error('Failed to get organization:', error);
  }

  // Example 4: Building a buying committee report
  console.log('\n=== Example 4: Buying Committee Report ===\n');

  try {
    const domain = 'tapestry.com';
    const [executives, orgData] = await Promise.all([
      apollo.searchPeople(domain, ['CEO', 'CFO', 'CTO', 'CIO', 'VP Engineering'], 10),
      apollo.getOrganization(domain)
    ]);

    console.log('BUYING COMMITTEE REPORT');
    console.log('='.repeat(50));
    console.log(`Company: ${orgData.data.organization.name}`);
    console.log(`Industry: ${orgData.data.organization.industry}`);
    console.log(`Employees: ${orgData.data.organization.estimated_num_employees?.toLocaleString()}`);
    console.log('');

    console.log('KEY DECISION MAKERS:');
    console.log('-'.repeat(50));

    const decisionMakers = executives.data.people.filter(
      (p) => p.email_status === 'verified' || p.email_status === 'guessed'
    );

    decisionMakers.forEach((person, index) => {
      console.log(`${index + 1}. ${person.name} - ${person.title}`);
      console.log(`   📧 ${person.email || 'Email not available'}`);

      const workPhone = person.phone_numbers?.find((p) => p.type === 'work');
      if (workPhone) {
        console.log(`   📞 ${workPhone.sanitized_number}`);
      }

      console.log(`   🔗 ${person.linkedin_url || 'LinkedIn not available'}`);
      console.log('');
    });

    console.log('OUTREACH PRIORITY:');
    console.log('-'.repeat(50));
    console.log('1. CEO - Strategic decision maker');
    console.log('2. CTO/CIO - Technical buyer');
    console.log('3. CFO - Budget approver');
    console.log('4. VP Engineering - Technical influencer');
    console.log('');
  } catch (error) {
    logger.error('Failed to build buying committee report:', error);
  }
}

// Run examples
main().catch((error) => {
  logger.error('Example script failed:', error);
  process.exit(1);
});
