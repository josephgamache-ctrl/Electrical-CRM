import re

# Read the backup file
with open(r'c:/Users/josep/projects/MA_Electrical_Inventory/backups/20241222_pre_features/database_backup.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the inventory COPY section
start_marker = "COPY public.inventory"

# Find start and end
start_idx = content.find(start_marker)
if start_idx == -1:
    print("Could not find inventory section")
    exit(1)

# Find the header line end
header_end = content.find('\n', start_idx)
data_start = header_end + 1

# Find the end marker (backslash dot on its own line)
search_text = content[data_start:]
lines = []
for line in search_text.split('\n'):
    if line.strip() == r'\.' or line.strip() == '\\.' :
        break
    if line.strip():
        lines.append(line)

print(f"Found {len(lines)} inventory items")

# Parse the columns from header
header = content[start_idx:header_end]
col_match = re.search(r'\((.*?)\) FROM stdin', header)
if col_match:
    cols = [c.strip() for c in col_match.group(1).split(',')]
    print(f"Columns: {len(cols)}")

# Build index mapping
backup_idx = {col: i for i, col in enumerate(cols)}

output_lines = []
output_lines.append("-- Inventory import from backup - qty set to 0")
output_lines.append("-- Delete existing inventory and reset sequence")
output_lines.append("DELETE FROM inventory;")
output_lines.append("ALTER SEQUENCE inventory_id_seq RESTART WITH 1;")
output_lines.append("")

# Production columns in order (without id - let it auto-increment)
prod_cols = ['item_id', 'sku', 'brand', 'upc', 'description', 'category', 'subcategory',
             'cost', 'retail', 'granite_city_price', 'markup_percent', 'sell_price',
             'qty', 'min_stock', 'location', 'qty_per', 'weight_lbs', 'voltage', 'amperage',
             'wire_gauge', 'wire_type', 'num_poles', 'ma_code_ref', 'nec_ref', 'ul_listed',
             'certifications', 'vendor_part_number', 'manufacturer_part_number',
             'lead_time_days', 'image_url', 'datasheet_pdf', 'installation_guide', 'notes', 'active']

# Mapping from backup columns to production columns
col_mapping = {
    'item_id': 'item_id',
    'sku': 'sku',
    'brand': 'brand',
    'upc': 'upc',
    'manufacturer_part_number': 'manufacturer_part_number',
    'description': 'description',
    'category': 'category',
    'subcategory': 'subcategory',
    'cost': 'cost',
    'list_price': 'retail',
    'contractor_price': 'granite_city_price',
    'markup_percent': 'markup_percent',
    'sell_price': 'sell_price',
    'qty': 'qty',
    'min_stock': 'min_stock',
    'location': 'location',
    'qty_per': 'qty_per',
    'weight_lbs': 'weight_lbs',
    'voltage': 'voltage',
    'amperage': 'amperage',
    'wire_gauge': 'wire_gauge',
    'wire_type': 'wire_type',
    'num_poles': 'num_poles',
    'ma_code_ref': 'ma_code_ref',
    'nec_ref': 'nec_ref',
    'ul_listed': 'ul_listed',
    'certifications': 'certifications',
    'vendor_part_number': 'vendor_part_number',
    'lead_time_days': 'lead_time_days',
    'image_url': 'image_url',
    'datasheet_pdf': 'datasheet_pdf',
    'installation_guide': 'installation_guide',
    'notes': 'notes',
    'active': 'active',
}

# Reverse mapping: production column -> backup column
prod_to_backup = {v: k for k, v in col_mapping.items()}

output_lines.append(f"INSERT INTO inventory ({', '.join(prod_cols)}) VALUES")

values = []
null_str = '\\N'  # PostgreSQL null marker in COPY format

for line in lines:
    fields = line.split('\t')
    if len(fields) < 10:  # Skip invalid lines
        continue

    row_values = []
    for prod_col in prod_cols:
        if prod_col == 'qty':
            row_values.append('0')  # Set qty to 0 as requested
        else:
            # Find the backup column name
            backup_col = prod_to_backup.get(prod_col, prod_col)

            if backup_col in backup_idx:
                val = fields[backup_idx[backup_col]]
                if val == null_str or val == '':
                    row_values.append('NULL')
                elif prod_col in ['cost', 'retail', 'granite_city_price', 'markup_percent', 'sell_price', 'weight_lbs', 'min_stock', 'lead_time_days', 'num_poles']:
                    row_values.append(val if val else '0')
                elif prod_col in ['ul_listed', 'active']:
                    row_values.append('true' if val == 't' else 'false')
                else:
                    # Escape single quotes for SQL
                    escaped = val.replace("'", "''")
                    row_values.append(f"'{escaped}'" if escaped else 'NULL')
            else:
                row_values.append('NULL')

    values.append(f"({', '.join(row_values)})")

output_lines.append(',\n'.join(values))
output_lines.append(";")
output_lines.append("")
output_lines.append("-- Update sequence to max id")
output_lines.append("SELECT setval('inventory_id_seq', COALESCE((SELECT MAX(id) FROM inventory), 1));")
output_lines.append("")
output_lines.append("-- Show count")
output_lines.append("SELECT COUNT(*) as inventory_count FROM inventory;")

# Write output
with open(r'c:/Users/josep/projects/MA_Electrical_Inventory/production_inventory.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print(f"Created production_inventory.sql with {len(values)} items")
