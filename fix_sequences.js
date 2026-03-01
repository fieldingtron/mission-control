import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
  console.log("Checking max IDs...");
  const maxPanel = await supabase.from('panels').select('id').order('id', { ascending: false }).limit(1);
  const maxCat = await supabase.from('categories').select('id').order('id', { ascending: false }).limit(1);
  const maxLink = await supabase.from('links').select('id').order('id', { ascending: false }).limit(1);

  console.log('Panels Max ID:', maxPanel.data?.[0]?.id);
  console.log('Categories Max ID:', maxCat.data?.[0]?.id);
  console.log('Links Max ID:', maxLink.data?.[0]?.id);

  console.log("To fix the duplicate key constraint, please run the contents of 'supabase_sync_sequences.sql' in your Supabase SQL Editor, then execute `SELECT sync_sequences();`");
}

run();
