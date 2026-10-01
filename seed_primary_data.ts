import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

interface CompetenceDef {
  code: string;
  name: string;
  order: number;
  criteria: {
    label: string;
    order: number;
    defaultMax: number;
  }[];
}

export const PRIMARY_COMPETENCES_DEF: CompetenceDef[] = [
  {
    code: "1A",
    name: "COMMUNIQUER EN FRANÇAIS",
    order: 1,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 20 },
      { label: "2 : Écrite", order: 2, defaultMax: 15 },
      { label: "3 : Savoir-être", order: 3, defaultMax: 5 },
    ],
  },
  {
    code: "1B",
    name: "COMMUNIQUER EN ANGLAIS",
    order: 2,
    criteria: [
      { label: "1 : Oral", order: 1, defaultMax: 20 },
      { label: "2 : Written", order: 2, defaultMax: 15 },
      { label: "3 : Attitude", order: 3, defaultMax: 5 },
    ],
  },
  {
    code: "1C",
    name: "PRATIQUER UNE LANGUE NATIONALE",
    order: 3,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 10 },
      { label: "2 : Écrite", order: 2, defaultMax: 5 },
      { label: "3 : Pratique", order: 3, defaultMax: 3 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 2 },
    ],
  },
  {
    code: "2A",
    name: "UTILISER LES NOTIONS DE BASE EN MATHÉMATIQUES",
    order: 4,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 5 },
      { label: "2 : Écrite", order: 2, defaultMax: 20 },
      { label: "3 : Savoir-être", order: 3, defaultMax: 5 },
    ],
  },
  {
    code: "2B",
    name: "UTILISER LES NOTIONS DE BASE EN SCIENCES ET TECHNOLOGIES",
    order: 5,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 5 },
      { label: "2 : Écrite", order: 2, defaultMax: 5 },
      { label: "3 : Pratique", order: 3, defaultMax: 15 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 5 },
    ],
  },
  {
    code: "3B",
    name: "PRATIQUER LES VALEURS CITOYENNES",
    order: 6,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 5 },
      { label: "2 : Écrite", order: 2, defaultMax: 5 },
      { label: "3 : Pratique", order: 3, defaultMax: 8 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 2 },
    ],
  },
  {
    code: "4",
    name: "DÉMONTRER L’AUTONOMIE, L’ESPRIT D’INITIATIVE, DE CRÉATIVITÉ ET D’ENTREPRENEURIAT",
    order: 7,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 5 },
      { label: "2 : Écrite", order: 2, defaultMax: 3 },
      { label: "3 : Pratique", order: 3, defaultMax: 10 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 2 },
    ],
  },
  {
    code: "5",
    name: "UTILISER LES CONCEPTS DE BASE ET LES OUTILS DES TIC",
    order: 8,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 3 },
      { label: "2 : Écrite", order: 2, defaultMax: 3 },
      { label: "3 : Pratique", order: 3, defaultMax: 10 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 4 },
    ],
  },
  {
    code: "6A1",
    name: "PRATIQUER LES ACTIVITÉS PHYSIQUES ET SPORTIVES POUR LES APPRENANTS APTES",
    order: 9,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 3 },
      { label: "2 : Écrite", order: 2, defaultMax: 3 },
      { label: "3 : Pratique", order: 3, defaultMax: 10 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 4 },
    ],
  },
  {
    code: "6B",
    name: "PRATIQUER LES ACTIVITÉS ARTISTIQUES",
    order: 10,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 4 },
      { label: "2 : Écrite", order: 2, defaultMax: 3 },
      { label: "3 : Pratique", order: 3, defaultMax: 10 },
      { label: "4 : Savoir-être", order: 4, defaultMax: 3 },
    ],
  },
  {
    code: "6A2",
    name: "LEADERSHIP & BON CARACTÈRE",
    order: 11,
    criteria: [
      { label: "1 : Orale", order: 1, defaultMax: 6 },
      { label: "2 : Écrite", order: 2, defaultMax: 12 },
      { label: "3 : Savoir-être", order: 3, defaultMax: 2 },
    ],
  },
];

async function seed() {
  console.log("--> Authentification admin...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: "r6QT?K$N#PW2LpG",
  });
  if (authErr) {
    throw new Error(`Échec authentification admin: ${authErr.message}`);
  }
  console.log("✓ Authentifié en tant que principal");

  console.log("--> Début du seed des 11 compétences primaires...");
  const levels = ["SIL", "CP", "CE1", "CE2", "CM1", "CM2"];

  for (const comp of PRIMARY_COMPETENCES_DEF) {
    // 1. Domaine / Compétence
    let domainId: string = "";
    const { data: existingDomain } = await supabase
      .from("primary_domains")
      .select("id")
      .eq("code", comp.code)
      .maybeSingle();

    if (existingDomain) {
      domainId = existingDomain.id;
      await supabase
        .from("primary_domains")
        .update({ name: comp.name, order_index: comp.order })
        .eq("id", domainId);
      console.log(`  [Domaine mis à jour] ${comp.code} - ${comp.name}`);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("primary_domains")
        .insert({ code: comp.code, name: comp.name, order_index: comp.order })
        .select("id")
        .single();
      if (insErr) {
        console.error("Erreur insertion domaine", comp.code, insErr);
        continue;
      }
      domainId = inserted.id;
      console.log(`  [Domaine créé] ${comp.code} - ${comp.name}`);
    }

    // 2. Critères d'évaluation
    for (const crit of comp.criteria) {
      let subId: string = "";
      const { data: existingSub } = await supabase
        .from("primary_sub_evaluations")
        .select("id")
        .eq("domain_id", domainId)
        .eq("label", crit.label)
        .maybeSingle();

      if (existingSub) {
        subId = existingSub.id;
        await supabase
          .from("primary_sub_evaluations")
          .update({ order_index: crit.order })
          .eq("id", subId);
      } else {
        const { data: subInserted, error: subErr } = await supabase
          .from("primary_sub_evaluations")
          .insert({ domain_id: domainId, label: crit.label, order_index: crit.order })
          .select("id")
          .single();
        if (subErr) {
          console.error("Erreur insertion critère", crit.label, subErr);
          continue;
        }
        subId = subInserted.id;
      }

      // 3. Barèmes par niveau
      for (const lvl of levels) {
        const { data: existingScale } = await supabase
          .from("primary_scales")
          .select("id")
          .eq("sub_evaluation_id", subId)
          .eq("level", lvl)
          .maybeSingle();

        if (!existingScale) {
          await supabase.from("primary_scales").insert({
            level: lvl,
            sub_evaluation_id: subId,
            max_score: crit.defaultMax,
          });
        }
      }
    }
  }

  console.log("✓ Toutes les 11 compétences et leurs critères ont été insérés avec succès !");
}

seed().catch(console.error);
