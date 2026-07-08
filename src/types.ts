/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InventoryItem {
  id: string;
  name: string;
  batchId: string;
  stock: number;
  unit: string;
  status: 'Low Stock' | 'Optimal' | 'Critical';
}

export interface CheckedInDoctor {
  id: string;
  name: string;
  specialization: string;
  shift: 'Day' | 'Night';
  status: 'Active' | 'Off-Duty';
  avatar: string;
}

export interface MatrixItem {
  phcId: string;
  name: string;
  itemNeeded: string;
  stockLevel: number;
  unit: string;
  status: 'Healthy' | 'Low Stock' | 'CRITICAL DEFICIT' | 'Low Stock';
  id?: string;
  distance?: string;
  roadStatus?: string;
  qtyNeeded?: number;
  contact?: string;
  coordinates?: string;
  predictiveRisk?: 'high_stock_out' | 'epidemic_spike' | 'stable';
  riskProbability?: number;
  riskReason?: string;
}

export interface ActivityEvent {
  id: string;
  phcId: string | null;
  type: 'inventory' | 'attendance' | 'error' | 'alert' | 'system';
  content: string;
  timestamp: string;
  source: string;
  highlighted?: boolean;
}

export interface ParseResult {
  health_center_id: string | null;
  updates: {
    medicine_name: 'paracetamol_stock' | 'anti_venom_stock' | null;
    quantity_used: number;
    doctor_present: boolean | null;
  };
}
