export const seedProducts = [
  { id: 'P-2048', name: 'Studio Headphones', category: 'Audio', brand: 'Auraline', sku: 'AUR-HX-2048', price: 289, cost: 146, stock: 84, min: 20, warehouse: 'Northstar · A1', supplier: 'Auraline Supply Co.', image: 'photo-1505740420928-5e560c06d30e', tone: 'sand' },
  { id: 'P-2047', name: 'Arc Desk Lamp', category: 'Workspace', brand: 'Forma', sku: 'FRM-LP-041', price: 198, cost: 92, stock: 12, min: 18, warehouse: 'Northstar · B4', supplier: 'Forma Living', image: 'photo-1507473885765-e6ed057f782c', tone: 'blue' },
  { id: 'P-2046', name: 'Everyday Carry Tote', category: 'Accessories', brand: 'Common Ground', sku: 'CGD-CT-092', price: 86, cost: 29, stock: 156, min: 32, warehouse: 'Brooklyn · C2', supplier: 'Common Ground Studio', image: 'photo-1590874103328-eac38a683ce7', tone: 'rose' },
  { id: 'P-2045', name: 'Ridge Ceramic Set', category: 'Home', brand: 'Studio Noma', sku: 'NOM-CR-305', price: 124, cost: 58, stock: 0, min: 14, warehouse: 'Northstar · D1', supplier: 'Noma House', image: 'photo-1490312278390-ab64016e0aa9', tone: 'sage' },
  { id: 'P-2044', name: 'Alto Wireless Speaker', category: 'Audio', brand: 'Auraline', sku: 'AUR-SP-118', price: 349, cost: 181, stock: 48, min: 16, warehouse: 'Brooklyn · A8', supplier: 'Auraline Supply Co.', image: 'photo-1608043152269-423dbba4e7e1', tone: 'blue' },
  { id: 'P-2043', name: 'Field Notes Journal', category: 'Stationery', brand: 'Paper People', sku: 'PAP-JR-070', price: 32, cost: 8, stock: 9, min: 24, warehouse: 'Northstar · E3', supplier: 'Paper People Inc.', image: 'photo-1531346878377-a5be20888e57', tone: 'sand' },
  { id: 'P-2042', name: 'No. 04 Hand Wash', category: 'Wellness', brand: 'Still Life', sku: 'STL-HW-004', price: 28, cost: 9, stock: 226, min: 36, warehouse: 'Brooklyn · F2', supplier: 'Still Life Goods', image: 'photo-1608571423902-eed4a5ad8108', tone: 'sage' },
  { id: 'P-2041', name: 'Cloud Knit Throw', category: 'Home', brand: 'Studio Noma', sku: 'NOM-KT-211', price: 178, cost: 76, stock: 31, min: 12, warehouse: 'Northstar · D6', supplier: 'Noma House', image: 'photo-1600210492486-724fe5c67fb0', tone: 'rose' },
]

export const seedOrders = [
  { id: 'PO-0084', supplier: 'Auraline Supply Co.', date: 'Oct 28, 2026', items: 3, total: 12480, status: 'In transit' },
  { id: 'PO-0083', supplier: 'Forma Living', date: 'Oct 24, 2026', items: 2, total: 6840, status: 'Awaiting approval' },
  { id: 'PO-0082', supplier: 'Still Life Goods', date: 'Oct 21, 2026', items: 5, total: 3920, status: 'Received' },
]

export const activity = [
  { icon: 'arrow', title: 'Stock received', detail: 'Alto Wireless Speaker · 24 units', time: '12 min ago', color: 'green' },
  { icon: 'bag', title: 'Purchase order created', detail: 'PO-0084 · Auraline Supply Co.', time: '48 min ago', color: 'gold' },
  { icon: 'edit', title: 'Inventory adjusted', detail: 'Field Notes Journal · −3 units', time: '2 hours ago', color: 'blue' },
  { icon: 'check', title: 'Order fulfilled', detail: 'SO-1294 · 6 items shipped', time: '3 hours ago', color: 'green' },
]

export const trend = [
  { month: 'May', value: 38, orders: 24 }, { month: 'Jun', value: 46, orders: 31 }, { month: 'Jul', value: 41, orders: 28 },
  { month: 'Aug', value: 57, orders: 39 }, { month: 'Sep', value: 52, orders: 34 }, { month: 'Oct', value: 72, orders: 46 },
]
