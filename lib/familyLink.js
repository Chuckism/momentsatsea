'use client';
import { supabase } from './supabaseClient';

/**
 * Ensures the signed-in user belongs to a family.
 * - If the user already belongs to a family, returns that family_id.
 * - Otherwise, creates a new family and links the user as 'owner'.
 */
export async function ensureFamily(user) {
  console.log('👀 ensureFamily called with user:', user);

  // 🔧 Diagnostics: verify Supabase client
  console.log(
    '[Supabase Check] supabase is',
    typeof supabase,
    supabase ? '✅ initialized' : '❌ null'
  );

  if (!user?.id) {
    console.warn('❌ ensureFamily: no user ID');
    return null;
  }

  try {
    // 1) Check existing membership WITHOUT .single()/.maybeSingle()
    console.log('🔍 Checking existing family membership...');
    const { data: rows, error: checkErr } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', user.id)
      .limit(1);

    if (checkErr) {
      console.error('❌ SELECT family_members failed:', checkErr);
      throw checkErr;
    }

    const existing = Array.isArray(rows) && rows.length ? rows[0] : null;

    if (existing?.family_id) {
      console.log(`✅ Existing family found: ${existing.family_id}`);
      return existing.family_id;
    }

    // 2) Create a new family
    console.log('🆕 No family found, creating a new one...');
    const { data: famInsert, error: famErr } = await supabase
      .from('families')
      .insert({
        name: `${(user.email || 'user').split('@')[0]}'s Family`,
        owner: user.id, // owner column is UUID and matches auth.uid()
      })
      .select('id'); // no .single(); read first row

    if (famErr) {
      console.error('❌ Family creation failed:', {
        message: famErr?.message,
        details: famErr?.details,
        hint: famErr?.hint,
        code: famErr?.code,
      });
      return null;
    }

    const familyId = Array.isArray(famInsert) && famInsert.length ? famInsert[0].id : null;
    if (!familyId) {
      console.error('❌ Family creation returned no id');
      return null;
    }

    console.log(`✅ New family created: ${familyId}`);

    // 3) Link the user to the family
    console.log('👥 Adding user to family_members...');
    const { error: memberErr } = await supabase
      .from('family_members')
      .insert({
        family_id: familyId,
        user_id: user.id,
        role: 'owner',
      });

    if (memberErr) {
      console.error('❌ Failed to add member:', {
        message: memberErr?.message,
        details: memberErr?.details,
        hint: memberErr?.hint,
        code: memberErr?.code,
      });
      // Still return the new familyId so the app can proceed gracefully.
      return familyId;
    }

    console.log(`✅ ensureFamily: linked ${user.email} to family ${familyId}`);
    return familyId;
  } catch (err) {
    console.group('❌ ensureFamily failed');
    console.error('Full error object:', err);
    console.error('Error message:', err?.message);
    console.error('Error details:', err?.details);
    console.error('Error hint:', err?.hint);
    console.error('Error code:', err?.code);
    console.groupEnd();
    return null;
  }
}
