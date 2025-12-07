'use client';

import { supabase } from './supabaseClient';

function getDeviceId() {
  try {
    let id = localStorage.getItem('mas_device_id');
    if (!id) {
      const rand = Math.random().toString(16).slice(2);
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${rand}`;
      localStorage.setItem('mas_device_id', id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * submitKeepsakeOrder
 * Requires the user to be signed in (RLS protected).
 *
 * @param {Object} p
 * @param {Object|string} p.cruise  - cruise object or cruiseId
 * @param {Array}  p.items           - [{sku, qty, options}]
 * @param {Object} p.contact         - {name,email,phone,address}
 * @param {String} p.notes
 * @param {Number} p.totalCents
 * @param {String} p.currency
 * @returns {Promise<{id: string, created_at: string, status: string}>}
 */
export async function submitKeepsakeOrder({
  cruise,
  items = [],
  contact = null,
  notes = '',
  totalCents = null,
  currency = 'USD',
}) {
  if (!supabase) throw new Error('Supabase not configured');

  // Require sign-in (aligns with RLS policies)
  let userId = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
  } catch {}
  if (!userId) {
    throw new Error('Please sign in to place an order.');
  }

  const row = {
    cruise_id: typeof cruise === 'string' ? cruise : cruise?.id,
    device_id: getDeviceId(),
    user_id: userId,
    contact,
    items,
    notes,
    total_cents: totalCents,
    currency,
    status: 'submitted',
  };

  const { data, error } = await supabase
    .from('keepsake_orders')
    .insert(row)
    .select('id, created_at, status')
    .single();

  if (error) throw error;
  return data;
}
