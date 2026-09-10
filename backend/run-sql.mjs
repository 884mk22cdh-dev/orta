// Выполняет .sql файл в базе проекта через Supabase Management API.
//
//   SUPABASE_PAT=sbp_xxx node backend/run-sql.mjs backend/groups-course.sql
//
// Токен: https://supabase.com/dashboard/account/tokens (после можно отозвать)

import fs from 'fs';

const REF = 'zqjbvrfpuusemdsurskc';
const PAT = process.env.SUPABASE_PAT;
const file = process.argv[2];

if (!PAT || !file) {
  console.error('SUPABASE_PAT=sbp_xxx node backend/run-sql.mjs <файл.sql>');
  process.exit(1);
}

const sql = fs.readFileSync(file, 'utf8');

const run = async query => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 600)}`);
  try { return JSON.parse(text); } catch { return text; }
};

console.log(`— ВЫПОЛНЯЮ ${file} (${sql.split('\n').length} строк) —`);
try {
  const out = await run(sql);
  console.log('✅ выполнено без ошибок');
  if (Array.isArray(out) && out.length) console.log(JSON.stringify(out).slice(0, 400));
} catch (e) {
  console.log('❌ ' + e.message);
  process.exit(1);
}
