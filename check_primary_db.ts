import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
}
if (!process.env.SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
}
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data: domains, error: e1 } = await supabase.from('primary_domains').select('*').order('order_index');
  console.log('--- DOMAINS ---', domains?.length, e1 || '');
  console.log(JSON.stringify(domains, null, 2));

  const { data: subs, error: e2 } = await supabase.from('primary_sub_evaluations').select('*').order('order_index');
  console.log('--- SUB EVALS count ---', subs?.length, e2 || '');
  console.log(JSON.stringify(subs, null, 2));

  const { data: scales, error: e3 } = await supabase.from('primary_scales').select('*');
  console.log('--- SCALES count ---', scales?.length, e3 || '');
  console.log(JSON.stringify(scales?.slice(0, 20), null, 2));
}

main().catch(console.error);
