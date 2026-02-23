import openpyxl

wb = openpyxl.load_workbook('HORARIOS 2026.xlsx')
ws = wb.active

print("Filas con datos:")
count = 0
for row in ws.iter_rows(min_row=1, max_row=50, values_only=True):
    row_list = [str(c) if c else '' for c in row[:20]]
    if any(c for c in row_list):
        print(row_list)
        count += 1
        if count > 40:
            break
