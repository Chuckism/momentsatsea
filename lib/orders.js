'use client';
import { supabase } from './supabaseClient';

function getDeviceId() {
  try {
    let id = localStorage.getItem('mas_device_id');
    if (!id) {
      id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      localStorage.setItem('mas_device_id', id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * submitKeepsakeOrder
 * @param {Object} p
 * @param {Object|string} p.cruise  - cruise object or cruiseId
 * @param {Array}  p.items           - [{sku, qty, options}]
 * @param {Object} p.contact         - {name,email,phone,address}
 * @param {String} p.notes
 * @param {Number} p.totalCents
 * @param {String} p.currency
 * @returns {Promise<{id: string, created_at: string}>}
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

  let user_id = null;
  try {
    const { data } = await supabase.auth.getUser();
    user_id = data?.user?.id || null;
  } catch {}

  const row = {
    cruise_id: typeof cruise === 'string' ? cruise : cruise?.id,
    device_id: getDeviceId(),
    user_id,
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
    .select('id, created_at')
    .single();

  if (error) throw error;
  return data;
}
