/**
 * Run hyperscaler migration directly via Supabase REST API
 */

const SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

async function checkColumnExists(): Promise<boolean> {
  // Try to query with cloud_tech - if column doesn't exist, we'll get an error
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?select=cloud_tech&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  );

  if (!response.ok) {
    const text = await response.text();
    if (text.includes('cloud_tech')) {
      return false; // Column doesn't exist
    }
  }
  return true;
}

async function main() {
  console.log("Checking if cloud_tech column exists...");

  const exists = await checkColumnExists();

  if (exists) {
    console.log("cloud_tech column already exists!");
  } else {
    console.log("cloud_tech column does NOT exist.");
    console.log("\nYou need to run the migration manually in Supabase Dashboard:");
    console.log("1. Go to https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/sql");
    console.log("2. Paste and run this SQL:\n");
    console.log(`
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cloud_tech VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_companies_cloud ON companies(cloud_tech) WHERE cloud_tech IS NOT NULL;

INSERT INTO tech_options (galaxy, slug, display_name, partner_name, is_competitor, display_order) VALUES
    ('cloud', 'AWS', 'Amazon Web Services', 'AWS', FALSE, 1),
    ('cloud', 'Azure', 'Microsoft Azure', 'Microsoft', FALSE, 2)
ON CONFLICT (galaxy, slug) DO NOTHING;
    `);
  }
}

main().catch(console.error);
