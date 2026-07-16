"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PersonSeed = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  family_role: string;
  birth_date: string | null;
};

const PEOPLE_SEED: PersonSeed[] = [
  {
    first_name: "Augusto",
    last_name: "Seixas",
    email: null,
    phone: null,
    family_role: "Administrador",
    birth_date: null,
  },
  {
    first_name: "Maria",
    last_name: "Jose",
    email: null,
    phone: null,
    family_role: "Familiar",
    birth_date: null,
  },
  {
    first_name: "Rodrigo Alves",
    last_name: "Seixas",
    email: null,
    phone: null,
    family_role: "Familiar",
    birth_date: null,
  },
  {
    first_name: "Marcella Andrade Ribeiro",
    last_name: "Seixas",
    email: null,
    phone: null,
    family_role: "Familiar",
    birth_date: null,
  },
];

export async function bootstrapSeixasFamily() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let familyId: string | null = null;

  const { data: existingMembership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingMembership?.family_id) {
    familyId = existingMembership.family_id;
  }

  if (!familyId) {
    const { data: createdFamily, error: familyError } = await supabase
      .from("families")
      .insert({
        name: "Familia Seixas",
        description: "Nucleo inicial do SeixasOS MVP 0.1",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (familyError || !createdFamily) {
      redirect("/dashboard?setup=error_family");
    }

    familyId = createdFamily.id;
  }

  await supabase.from("family_members").upsert(
    {
      family_id: familyId,
      user_id: user.id,
      role: "admin",
      status: "active",
      joined_at: new Date().toISOString(),
    },
    { onConflict: "family_id,user_id" }
  );

  for (const person of PEOPLE_SEED) {
    const { data: found } = await supabase
      .from("people")
      .select("id")
      .eq("family_id", familyId)
      .eq("first_name", person.first_name)
      .eq("last_name", person.last_name)
      .limit(1)
      .maybeSingle();

    if (!found) {
      await supabase.from("people").insert({
        family_id: familyId,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone,
        family_role: person.family_role,
        birth_date: person.birth_date,
        status: "active",
      });
    }
  }

  const { data: augusto } = await supabase
    .from("people")
    .select("id")
    .eq("family_id", familyId)
    .eq("first_name", "Augusto")
    .eq("last_name", "Seixas")
    .limit(1)
    .maybeSingle();

  if (augusto?.id) {
    await supabase
      .from("family_members")
      .update({ person_id: augusto.id, role: "admin", status: "active" })
      .eq("family_id", familyId)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/pessoas");
  redirect("/dashboard?setup=ok");
}
