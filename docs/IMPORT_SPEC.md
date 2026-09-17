# bills.xlsx Import Specification

## Scope
Historical source is `bills.xlsx`.

Import only:
- sheets whose names represent a month and year,
- approximately the latest 24 months.

Ignore:
- Florida Template
- Florida Template bkp
- Georgia Template
- Info
- Money
- Credit Overview
- House Template
- other template/reference tabs
- columns W and later

## Preserve raw source
Every imported row should preserve:
- source workbook
- source sheet
- source row
- raw values
- import run id
- imported timestamp

## Normalize cautiously
The source mixes:
- bills
- paycheck allocations
- income
- debts
- notes
- reminders
- one-time obligations
- duplicate planning rows
- status markers

Do not assume every label is a canonical bill.

## Core extraction
For each likely bill occurrence capture when available:
- raw name
- month
- expected amount
- due-date text
- paycheck allocation amounts
- status marker
- notes
- source coordinates

## Alias handling
Names like:
- Water / Water & Trash
- One Main / OneMain / One Main Loan
- ChatGpt / ChatGPT

may be proposed as aliases but not silently merged unless deterministic identity evidence exists.

## Current context
Tag May 2026 onward as Florida/current-home context.
Older imported data defaults to prior/Georgia context unless explicitly portable.
