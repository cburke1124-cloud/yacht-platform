path = r'C:\Users\cburk\yacht-platform\backend\app\services\scraper.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

marker = "        # Description fallback: if AI still didn't return one, use deterministic extract"

insert = """        # Reconstruct title as 'YEAR MAKE MODEL' whenever we have make/model data.
        # Length is displayed separately on listing cards, so it is excluded from title.
        _t_year  = yacht_data.get('year')
        _t_make  = yacht_data.get('make')
        _t_model = yacht_data.get('model')
        if _t_make or _t_model:
            _rebuilt = ' '.join(filter(None, [
                str(_t_year) if _t_year else '',
                _t_make or '',
                _t_model or '',
            ])).strip()
            if _rebuilt:
                yacht_data['title'] = _rebuilt

        """

if marker in content:
    content = content.replace(marker, insert + marker, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS')
else:
    print('MARKER NOT FOUND')
