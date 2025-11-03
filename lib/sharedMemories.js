'use client';
import { supabase } from './supabaseClient';

// Publish a shared memory
export async function publishSharedMemory({ cruiseCode, authorName, photoUrl, caption }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to share a memory.');

  const { error } = await supabase.from('shared_memories').insert({
    cruise_code: cruiseCode,
    user_id: user.id,
    author_name: authorName || user.email,
    photo_url: photoUrl,
    caption: caption,
  });

  if (error) throw error;
  return true;
}

// Fetch shared memories for a given cruise
export async function fetchSharedMemories(cruiseCode) {
  const { data, error } = await supabase
    .from('shared_memories')
    .select('*')
    .eq('cruise_code', cruiseCode)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
