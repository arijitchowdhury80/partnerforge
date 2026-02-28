import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

async function main() {
  const { data, error } = await supabase
    .from("crossbeam_overlaps")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.log("Error:", error.message);
  } else if (data) {
    console.log("Columns:", Object.keys(data).join(", "));
    console.log("\nSample row:");
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
