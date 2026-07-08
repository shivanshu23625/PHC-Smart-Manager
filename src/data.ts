import { InventoryItem, CheckedInDoctor, MatrixItem, ActivityEvent } from './types';

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: '1',
    name: 'Paracetamol 500mg',
    batchId: 'BN-9921',
    stock: 500,
    unit: 'Units',
    status: 'Low Stock'
  },
  {
    id: '2',
    name: 'Polyvalent Anti-Venom',
    batchId: 'BN-1102',
    stock: 25,
    unit: 'Vials',
    status: 'Optimal'
  },
  {
    id: '3',
    name: 'Surgical Masks',
    batchId: 'BN-4482',
    stock: 1200,
    unit: 'Pcs',
    status: 'Optimal'
  },
  {
    id: '4',
    name: 'Amoxicillin',
    batchId: 'BN-8831',
    stock: 150,
    unit: 'Vials',
    status: 'Optimal'
  },
  {
    id: '5',
    name: 'Insulin Glargine',
    batchId: 'BN-2244',
    stock: 80,
    unit: 'Vials',
    status: 'Optimal'
  }
];

export const INITIAL_DOCTORS: CheckedInDoctor[] = [
  {
    id: 'doc_1',
    name: 'Dr. Robert Chen',
    specialization: 'General Physician',
    shift: 'Day',
    status: 'Active',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxOECqIHjneGwkHrB39G2hPycTMpesFEg3mbuGn4quwwFuKYQ0OrHNmA9i8ukenkPpmx9RlN5yGNBJa1zr-_PzBL1fIXXxhnjpv0NJjTSz9om4PfmWBXcNiG7KpFcoK7LXqVoPgzSHmvACiTK-_gTJb8ixmWKAV0U8RDcSrr0zoe-ftnglVykdxFi_vlw-EHzUyxNUXIUiL9oIAqV9zztA66eVvW2CwALs3MnftEqOiLwo51I864m2ag'
  },
  {
    id: 'doc_2',
    name: 'Dr. Aris Thorne',
    specialization: 'Snakebite Specialist',
    shift: 'Night',
    status: 'Off-Duty',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDxF0AhMlan-_HB8M3WDpeIvqoLDccsG7VSyuADzAcwSzFGzTOQoBAMl0AylmuJb2meyG5A8JTPgCABHvFLo7dKQPjg_ojRpuZlIemjXH5qr5Go0NMQG4IS-5CIy3e5lpYvoiyQl8f2HaXhBu4ABJm66NptwVs1XMvsHw7df00D5JNX4OoEftHo9N4Cwj-L1GR_C-XdvplLB12Zk61AAQfA9kGDJOkjodjVjM7gytzP8V8K-U_NTzoobA'
  },
  {
    id: 'doc_3',
    name: 'Dr. Elena Rodriguez',
    specialization: 'Pediatrician',
    shift: 'Day',
    status: 'Active',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhInDq_DxbS_IwBfP_KajfVLkUUTzBiHYBza1PRwafV69vZXM-Pv7V-fi1Rw-8Y8DnNwIZ1F5tNMwbrm9sFgKw7O21J-mTY_VKuJgfwXJ6wjRMAS4AfnZaLSsWKEKl_T0n7QjSdIOOzYHz6JXwfulG3Prvks0qn5RBG2X5Chl11fz5IMwYd2ScNqDIX7EJl8atS7-tMqy6iWRKWGHu37_Q-05bvwNhHNiAzM2dvSyYZIf6J4X3CrPGYQ'
  }
];

export const INITIAL_MATRIX: MatrixItem[] = [
  {
    phcId: 'PHC_002',
    name: 'PHC_002 - Mangalore Central',
    itemNeeded: 'Paracetamol 500mg',
    stockLevel: 120,
    unit: 'units',
    status: 'Healthy',
    distance: '0 km',
    roadStatus: 'Clear / Asphalt',
    qtyNeeded: 500,
    contact: 'VHF Ch 12 (Base)',
    coordinates: '12.914° N, 74.856° E',
    predictiveRisk: 'stable',
    riskProbability: 12,
    riskReason: 'Consumption matching normal seasonal trend. Safe baseline buffer.'
  },
  {
    phcId: 'PHC_015',
    name: 'PHC_015 - Udupi North',
    itemNeeded: 'Anti-Venom Vials',
    stockLevel: 0,
    unit: 'units',
    status: 'CRITICAL DEFICIT',
    distance: '58 km',
    roadStatus: 'Partially Muddy',
    qtyNeeded: 35,
    contact: 'Radio Channel 4',
    coordinates: '13.341° N, 74.747° E',
    predictiveRisk: 'high_stock_out',
    riskProbability: 95,
    riskReason: '95% probability of severe Anti-Venom deficit due to local viper breeding season & zero local safety buffer.'
  },
  {
    phcId: 'PHC_022',
    name: 'PHC_022 - Bantwal Hub',
    itemNeeded: 'Amoxicillin',
    stockLevel: 45,
    unit: 'vials',
    status: 'Low Stock',
    distance: '24 km',
    roadStatus: 'Clear / Asphalt',
    qtyNeeded: 150,
    contact: 'Radio Channel 2',
    coordinates: '12.898° N, 75.039° E',
    predictiveRisk: 'stable',
    riskProbability: 34,
    riskReason: 'Minor consumption rise observed. Courier B routine supply recommended.'
  },
  {
    phcId: 'PHC_009',
    name: 'PHC_009 - Puttur East',
    itemNeeded: 'Surgical Masks',
    stockLevel: 2400,
    unit: 'units',
    status: 'Healthy',
    distance: '52 km',
    roadStatus: 'Rough Mud Road',
    qtyNeeded: 3000,
    contact: 'Radio Channel 9',
    coordinates: '12.723° N, 75.203° E',
    predictiveRisk: 'stable',
    riskProbability: 8,
    riskReason: 'Abundant buffer stock. Low seasonal variance predicted.'
  },
  {
    phcId: 'PHC_041',
    name: 'PHC_041 - Sullia West',
    itemNeeded: 'Insulin Glargine',
    stockLevel: 5,
    unit: 'vials',
    status: 'CRITICAL DEFICIT',
    distance: '86 km',
    roadStatus: 'Flooded / Impassable',
    qtyNeeded: 40,
    contact: 'HF Band Sec 3',
    coordinates: '12.556° N, 75.390° E',
    predictiveRisk: 'epidemic_spike',
    riskProbability: 84,
    riskReason: '84% risk of insulin storage failure due to power instability after river monsoon floods.'
  }
];

export const INITIAL_EVENTS: ActivityEvent[] = [
  {
    id: 'e1',
    phcId: 'PHC_002',
    type: 'inventory',
    content: 'PHC_002: Anti-Venom stock reduced by 10 units. Reason: Emergency Report Case. Current Stock: 5.',
    timestamp: '3 minutes ago',
    source: 'AI Text Parser'
  },
  {
    id: 'e2',
    phcId: 'PHC_005',
    type: 'attendance',
    content: 'Dr. Aditi Rao changed status to [Available] at PHC_005.',
    timestamp: '14 minutes ago',
    source: 'Manual Check-in'
  },
  {
    id: 'e3',
    phcId: 'PHC_999',
    type: 'error',
    content: "Failed Update: Unrecognized Health Center ID 'PHC_999' submitted in text report.",
    timestamp: '1 hour ago',
    source: 'AI Text Parser'
  },
  {
    id: 'e4',
    phcId: 'PHC_012',
    type: 'inventory',
    content: 'PHC_012: Automated restock order generated for Paracetamol 500mg (2000 units).',
    timestamp: '2 hours ago',
    source: 'Inventory Optimization Module'
  },
  {
    id: 'e5',
    phcId: null,
    type: 'system',
    content: 'System Notice: Backup power generator at Regional Warehouse B initiated self-test. Status: Normal.',
    timestamp: '4 hours ago',
    source: 'IoT Gateway'
  }
];

export const REPORT_EXAMPLES = [
  {
    label: "Paracetamol & Doctor Present (PHC_002)",
    text: "Report for PHC_002: Used 40 paracetamol stock today. Dr Smith clear on duty and actively seeing patients."
  },
  {
    label: "Anti-Venom & Doctor Absent (PHC_002)",
    text: "Urgent from PHC_002 station. We had an emergency snakebite case and used 5 vials of anti venom stock. Doctor was absent today."
  },
  {
    label: "PCM & Doctor Present (PHC_001)",
    text: "PCM usage was 12 units at health station PHC_001. Dr Clear on duty, everything is fine."
  },
  {
    label: "Unrecognized Center ID (Warning)",
    text: "PHC_999 report: used 10 vials of snakebite kit. Dr clear on duty."
  }
];
