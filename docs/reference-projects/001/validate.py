"""Offline fixture integrity only. No runtime imports, network or credentials."""
from pathlib import Path
import datetime as dt
import hashlib
import json
import re

base = Path(__file__).resolve().parent
register = json.loads((base / 'source-register.json').read_text())
truth = json.loads((base / 'ground-truth.json').read_text())
docs = {d['id']: d for d in register['documents']}
assert len(docs) == len(register['documents']) == 15
assert len(truth['questions']) == 18
assert len({q['id'] for q in truth['questions']}) == 18
assert truth['evaluation_only'] and truth['never_ingest_as_project_evidence']
assert {p.name for p in (base / 'sources').iterdir()} == {Path(d['path']).name for d in docs.values()}
texts = {}
for identifier, record in docs.items():
    path = base / record['path']
    assert path.is_relative_to(base)
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], identifier
    text = raw.decode()
    texts[identifier] = text
    assert 'FICTIONAL BENCHMARK ONLY' in text
    assert 'RP001-JOB-01' in text and 'RP001-PROP-01' in text
    assert re.findall(r'^## (\w+) —', text, re.M) == record['locators']
    dt.date.fromisoformat(record['issued_on'])
    for email in re.findall(r'[\w.+-]+@[\w.-]+', text):
        assert email.rstrip('.').endswith('.example'), email
    for number in re.findall(r'\+1-[\d-]+', text):
        assert re.fullmatch(r'\+1-202-555-01\d{2}', number), number
    for referenced in re.findall(r'RP001-D\d{2}', text):
        assert referenced in docs, referenced
    for referenced, locator in re.findall(r'(RP001-D\d{2}) (S\d+|P\d+)', text):
        assert locator in docs[referenced]['locators'], (referenced, locator)

for question in truth['questions']:
    cutoff = dt.date.fromisoformat(question['as_of'])
    assert question['expected_answer'] and question['chronology_and_authority']
    assert question['epistemic_kind'] in {'documented_fact', 'inference', 'insufficient_evidence', 'conflicting_evidence'}
    for ref in question['authoritative_sources']:
        record = docs[ref['document']]
        assert ref['locator'] in record['locators'], ref
        assert dt.date.fromisoformat(record['issued_on']) <= cutoff, (question['id'], ref)

# Budget line items must reconcile in the actual source table, not just the key.
rows = []
for line in texts['RP001-D08'].splitlines():
    parts = [p.strip() for p in line.split('|')[1:-1]]
    if len(parts) == 4 and all(p.isdigit() for p in parts[1:]):
        rows.append((parts[0], *map(int, parts[1:])))
assert len(rows) == 7
for _, initial, change, revised in rows:
    assert initial + change == revised
assert tuple(sum(r[i] for r in rows[:-1]) for i in (1, 2, 3)) == rows[-1][1:]
assert rows[-1][1:] == (2480000, 4800, 2484800)
assert (dt.date(2027, 10, 3) - dt.date(2027, 9, 30)).days == 3

# Guard intentional contradictions and missing evidence against accidental cleanup.
assert 'Port 4 and loop B were not replaced' in texts['RP001-D15']
assert 'both living-room actuators' in texts['RP001-D15']
assert 'Binary, EXIF, scale calibration and image checksum are unavailable' in texts['RP001-D10']
assert 'RH-01/UC-001 is obsolete design information' in texts['RP001-D13']
assert 'cabinet paint selection/batch' in texts['RP001-D12']

# Resolve local Markdown links in the fixture index.
for link in re.findall(r'\]\(([^)]+)\)', (base / 'README.md').read_text()):
    assert (base / link).is_file(), link
print('PASS: 15 source hashes/headers/locators, cross-references, fictional contacts, 18 question references/as-of dates, budget totals, schedule arithmetic, intentional conflicts/gaps and index links.')
print('This validates fixture integrity, not model answer quality, PDF extraction, construction accuracy or tenant isolation.')
