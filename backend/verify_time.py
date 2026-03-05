import sys
try:
    with open('test_results.log', 'r', encoding='utf-16le') as f:
        for line in f:
            if 'Processed' in line:
                print(line.strip())
except Exception as e:
    print(e)
