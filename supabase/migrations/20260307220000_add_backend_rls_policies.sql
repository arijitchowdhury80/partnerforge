-- Migration 010: Add RLS Policies for Backend Operations
-- Allows backend (using anon key) to perform necessary operations
-- Following principle of least privilege

-- Companies table: Allow INSERT and SELECT
CREATE POLICY "Backend can insert companies"
  ON companies
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can select companies"
  ON companies
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Backend can update companies"
  ON companies
  FOR UPDATE
  TO anon
  USING (true);

-- Audits table: Allow INSERT, SELECT, and UPDATE
CREATE POLICY "Backend can insert audits"
  ON audits
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can select audits"
  ON audits
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Backend can update audits"
  ON audits
  FOR UPDATE
  TO anon
  USING (true);

-- Enrichment tables: Allow INSERT and SELECT
CREATE POLICY "Backend can insert traffic"
  ON company_traffic
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert financials"
  ON company_financials
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert technologies"
  ON company_technologies
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert competitors"
  ON company_competitors
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert executives"
  ON company_executives
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert quotes"
  ON executive_quotes
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert social profiles"
  ON company_social_profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert social posts"
  ON company_social_posts
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert buying committee"
  ON buying_committee
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert intent signals"
  ON intent_signals
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert hiring"
  ON company_hiring
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Activity tables: Allow INSERT
CREATE POLICY "Backend can insert audit log"
  ON audit_log
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert api call log"
  ON api_call_log
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert api error log"
  ON api_error_log
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Search audit tables: Allow INSERT
CREATE POLICY "Backend can insert search tests"
  ON search_audit_tests
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Backend can insert screenshots"
  ON search_audit_screenshots
  FOR INSERT
  TO anon
  WITH CHECK (true);
