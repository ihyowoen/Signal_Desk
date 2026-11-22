#!/usr/bin/env python3
"""SIL R53: SEC Micron CIK complete submissions and original file collector.
Only federal SEC hosts may be counted as government primary raw sources.
Safe conservative flags: remote bytes, complete history, check identities, no assertions on failures.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import random
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

CORP = '0000723125'
CIK = 723125
BASE = 'https://data.sec.gov/submissions/'
ROOT = 'https://www.sec.gov/Archives/edgar/data/723125/'
AS_OF = '2026-11-22'
REPORTS = [
    ('R40-MU-2024-Q1','10-Q','2023-11-30','2023-12-21','0000723125-23-000077','mu-20231130.htm'),
    ('R40-MU-2024-Q2','10-Q','2024-02-29','2024-03-21','0000723125-24-000007','mu-20240229.htm'),
    ('R40-MU-2024-Q3','10-Q','2024-05-30','2024-06-27','0000723125-24-000019','mu-20240530.htm'),
    ('R40-MU-2024-FY','10-K','2024-08-29','2024-10-04','0000723125-24-000027','mu-20240829.htm'),
    ('R40-MU-2025-Q1','10-Q','2024-11-28','2024-12-19','0000723125-24-000047','mu-20241128.htm'),
    ('R40-MU-2025-Q2','10-Q','2025-02-27','2025-03-21','0000723125-25-000009','mu-20250227.htm'),
    ('R40-MU-2025-Q3','10-Q','2025-05-29','2025-06-26','0000723125-25-000021','mu-20250529.htm'),
    ('R40-MU-2025-FY','10-K','2025-08-28','2025-10-03','0000723125-25-000028','mu-20250828.htm'),
    ('R40-MU-2026-Q1','10-Q','2025-11-27','2025-12-18','0000723125-25-000046','mu-20251127.htm'),
    ('R40-MU-2026-Q2','10-Q','2026-02-26','2026-03-19','0000723125-26-000006','mu-20260226.htm'),
    ('R40-MU-2026-Q3','10-Q','2026-05-28','2026-06-25','0000723125-26-000015','mu-20260528.htm'),
    ('R40-MU-2026-FY','10-K','2026-09-03','2026-10-09','0000723125-26-000023','mu-20260903.htm'),
]
UA = 'SIL Evidence Audit/1.0 (https://github.com/ihyowoen/Signal_Desk/issues)'
OUT = Path('out')
OUT.mkdir(exist_ok=True)
STATUS = {'as_of':AS_OF,'script_version':'R53-census-v1', 'identification': 'Official SEC CIK 0000723125; contact route GitHub issues; no email guessed', 'expected':len(REPORTS), 'history_files': [], 'official_raw_files': {},'lineage':{},'errors':[], 'history_complete':False,'note':'Failure to find amended form in partial history does not establish no amendments; HTTP 200 validation and SHA256 required'}
LAST = [0.0]

def digest(b): return hashlib.sha256(b).hexdigest()
def save_immutable(p, b):
    p.parent.mkdir(parents=True,exist_ok=True)
    if p.exists() and p.read_bytes() != b: raise ValueError('Different immutable source bytes: '+str(p))
    if not p.exists(): p.write_bytes(b)
    return {'path':str(p),'size_bytes':len(b),'sha256':digest(b)}

def get(url, *, retries=2):
    u=urlparse(url)
    if u.hostname not in {'data.sec.gov','www.sec.gov'} or u.scheme != 'https': raise ValueError('Non-SEC official host')
    for attempt in range(retries):
        now=time.monotonic()
        if now-LAST[0] < 1.05: time.sleep(1.05-(now-LAST[0]))
        LAST[0]=time.monotonic()
        req=Request(url,headers={'User-Agent':UA,'Accept':'application/json,text/html,text/plain,*/*','Accept-Encoding':'identity'})
        try:
            with urlopen(req,timeout=30) as response:
                b=response.read()
                if not b or not response.url.startswith('https://'): raise ValueError('Empty or invalid response')
                if b'<html' in b[:200].lower() and b'Access Denied' in b[:1000]: raise ValueError('Anti-bot denied HTML instead of source')
                return b
        except (HTTPError,URLError,TimeoutError) as e:
            if isinstance(e,HTTPError) and e.code not in (429,500,502,503,504): raise
            if attempt==retries-1: raise
            time.sleep(2+attempt*3)
    raise RuntimeError('Unreachable')

def extract(d):
    p=d.get('filings',{}).get('recent',d)
    cols=('accessionNumber','filingDate','reportDate','form','primaryDocument')
    if not all(isinstance(p.get(k),list) for k in cols): raise ValueError('Incomplete SEC schema')
    n=len(p['accessionNumber'])
    if n==0 or any(len(p[k])!=n for k in cols): raise ValueError('Misaligned SEC arrays')
    return [{k:p[k][i] for k in cols} for i in range(n)]

try:
    raw=get(BASE+'CIK'+CORP+'.json')
    save_immutable(OUT/'api'/'CIK0000723125.json',raw)
    root=json.loads(raw)
    assert int(root['cik'])==CIK
    histories=root['filings'].get('files',[])
    selected=[]
    for f in histories:
        if f['filingTo']>='2023-12-01' and f['filingFrom']<=AS_OF:
            if not re.fullmatch(r'[A-Za-z0-9_.-]+\.json',f['name']): raise ValueError('Bad history file name')
            selected.append(f['name'])
    all_entries=extract(root)
    for name in selected:
        x=get(BASE+name)
        save_immutable(OUT/'api'/name,x)
        all_entries+=extract(json.loads(x))
        STATUS['history_files'].append(name)
    latest={}
    for e in all_entries:
        acc=e['accessionNumber']
        if acc in latest and latest[acc]!=e: raise ValueError('Duplicate SEC accession conflict: '+acc)
        latest[acc]=e
    STATUS['total_company_submissions_in_scope_census']=len(latest)
    STATUS['history_complete']=len(STATUS['history_files'])==len(selected)
    STATUS['historical_files_expected']=selected
    for rid, form, report_date, file_date, acc, filename in REPORTS:
        item=latest.get(acc)
        if not item or item['reportDate']!=report_date or item['form']!=form or item['filingDate']!=file_date or item['primaryDocument']!=filename:
            STATUS['lineage'][rid]={'status':'BLOCKED_ORIGINAL_METADATA_MISMATCH','actual':item,'expected':{'form':form,'report_date':report_date,'file_date':file_date,'filename':filename}}
            continue
        relevant=[x for x in latest.values() if x['form']==form+'/A' and x['filingDate']>=file_date and x['filingDate']<=AS_OF]
        matched=[x for x in relevant if x.get('reportDate')==report_date]
        ambiguous=[x for x in relevant if not x.get('reportDate')]
        if ambiguous:
            # Period-less amendment submissions should be reviewed individually before concluding none.
            STATUS['lineage'][rid]={'status':'HISTORY_FULL_BUT_AMBIGUOUS_UNDATED_AMENDMENT','confirmed_accessions':matched,'undated_candidates':ambiguous}
        else:
            STATUS['lineage'][rid]={'status':'FULL_SEC_SUBMISSION_HISTORY_CANDIDATES_SCOPED','amendment_accessions':matched,'no_amendments_observed':not bool(matched),'review_needed':'Verify amendment original PDF/XBRL effects before FULL_PASS'}
except Exception as e:
    STATUS['errors'].append({'phase':'SEC_SUBMISSIONS','error':str(e)[:250]})

for rid, form, report_date, file_date, acc, filename in REPORTS:
    root=ROOT+acc.replace('-','')+'/'
    for source, remote in [('original_primary_html',filename),('complete_submission_txt',acc+'.txt')]:
        try:
            b=get(root+remote)
            if source=='original_primary_html':
                if b'Micron' not in b and b'MICRON' not in b: raise ValueError('Not a Micron original HTML filing')
                if b'<html' not in b[:1000].lower(): raise ValueError('Not SEC HTML original')
            if source=='complete_submission_txt' and not b.startswith(b'<SEC-DOCUMENT>'): raise ValueError('Not original SEC complete submission header')
            stamp=save_immutable(OUT/'filings'/acc/remote,b)
            STATUS['official_raw_files'].setdefault(rid,{})[source]=stamp
        except Exception as e:
            STATUS['errors'].append({'phase':'SOURCE_BYTES','record_id':rid,'source':source,'error':str(e)[:250]})
(OUT/'R53_SEC_RESULT.json').write_text(json.dumps(STATUS,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'history_complete':STATUS['history_complete'],'lineage_count':len(STATUS['lineage']),'raw_file_document_count':len([x for x in STATUS['official_raw_files'].values() if 'original_primary_html' in x]),'raw_submission_count':len([x for x in STATUS['official_raw_files'].values() if 'complete_submission_txt' in x]),'errors':len(STATUS['errors'])}))
if STATUS['errors']:
    print(json.dumps(STATUS['errors'][:5]))
    sys.exit(2)
