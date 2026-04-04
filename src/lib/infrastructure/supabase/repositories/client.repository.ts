/**
 * Supabase Repository 援ы - Client
 */

import type { SupabaseClient } from '../client';
import type { Client } from '@/lib/domain/types';
import type { IClientRepository } from '@/lib/domain/repositories/interfaces';
import type { JsonObject } from '@/lib/domain/types';

export class SupabaseClientRepository implements IClientRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Client | null> {
    const { data, error } = await this.db
      .from('workflow_clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as unknown as Client;
  }

  async findByOrganizationId(organizationId: string): Promise<Client[]> {
    const { data, error } = await this.db
      .from('workflow_clients')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    if (error) throw new Error(`clients 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as Client[];
  }

  async findActiveByOrganizationId(organizationId: string): Promise<Client[]> {
    const { data, error } = await this.db
      .from('workflow_clients')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`???clients 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as Client[];
  }

  async create(data: {
    organization_id: string;
    name: string;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    address?: string | null;
    notes?: string | null;
    service_type?: string;
    payment_type?: string;
    tier?: string;
    metadata?: JsonObject;
  }): Promise<Client> {
    const { data: row, error } = await this.db
      .from('workflow_clients')
      .insert(data)
      .select()
      .single();

    if (error || !row) throw new Error(`client ????ㅽ? ${error?.message}`);
    return row as unknown as Client;
  }

  async update(id: string, data: Partial<{
    name: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    notes: string | null;
    service_type: string;
    payment_type: string;
    tier: string;
    metadata: JsonObject;
    is_active: boolean;
  }>): Promise<Client> {
    const { data: row, error } = await this.db
      .from('workflow_clients')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !row) throw new Error(`client ?? ?ㅽ? ${error?.message}`);
    return row as unknown as Client;
  }
}
