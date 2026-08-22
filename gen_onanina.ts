import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
import { supabase } from './packages/shared/api/supabaseClient';
import { createStudentBulletinPdfBuffer } from './packages/shared/api/bulletinPdfService';
import * as fs from 'fs';

async function test() {
  const teacherPw = process.env.TEST_ENSEIGNANT_PW || "test_password";
  const principalPw = process.env.TEST_PRINCIPAL_PW || "test_password";

  console.log("Connexion en tant que Principal...");
  const { error: pAuthErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: principalPw,
  });

  if (pAuthErr) {
    console.error("Échec auth principal:", pAuthErr);
    process.exit(1);
  }

  const { data: students, error: sErr } = await supabase.from('students').select('*').ilike('last_name', '%ONANINA%');
  if (sErr || !students || students.length === 0) {
    console.error('Élève ONANINA non trouvé:', sErr);
    process.exit(1);
  }
  const student = students[0];
  console.log('Élève ONANINA trouvé, ID:', student.id);
  const seq1Id = 'cec81b85-a968-4321-b572-7abe627a9dbf';

  const pdfBytes = await createStudentBulletinPdfBuffer(student.id, seq1Id, 'sequence');
  fs.writeFileSync('generated_bulletin_ONANINA.pdf', pdfBytes);
  console.log('SUCCESS! PDF généré et enregistré dans generated_bulletin_ONANINA.pdf');
  process.exit(0);
}
test().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
