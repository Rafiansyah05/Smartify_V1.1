const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.trim().match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: tables, error: err2 } = await supabase.from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  if (err2) {
    console.error(err2);
  } else {
    console.log('Tables in public schema:', tables.map(t => t.table_name));
    
    // Get columns for quizzes
    const { data: cols } = await supabase.from('information_schema.columns')
      .select('table_name, column_name, data_type')
      .eq('table_schema', 'public');
    
    const schema = {};
    cols.forEach(c => {
      if (!schema[c.table_name]) schema[c.table_name] = [];
      schema[c.table_name].push(`${c.column_name} (${c.data_type})`);
    });
    console.log(JSON.stringify(schema, null, 2));
  }
}

checkSchema();
