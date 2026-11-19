import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { writeFileSync } from 'node:fs'

const doc = await PDFDocument.create()
const page = doc.addPage([595.28, 841.89]) // A4
const bold = await doc.embedFont(StandardFonts.HelveticaBold)
const body = await doc.embedFont(StandardFonts.Helvetica)

page.drawText('CrewBTC Limited Edition', { x: 60, y: 760, size: 28, font: bold, color: rgb(0,0,0) })
page.drawText('Series 02 — Obsidian', { x: 60, y: 720, size: 16, font: body })
page.drawText('Every element earns its pixels. This body copy exists to', { x: 60, y: 670, size: 11, font: body })
page.drawText('verify that multi-line extraction groups correctly.', { x: 60, y: 654, size: 11, font: body })
page.drawText('SKU-4471-BLK', { x: 60, y: 90, size: 10, font: body })

const bytes = await doc.save()
writeFileSync('/tmp/sample.pdf', bytes)
console.log('wrote /tmp/sample.pdf', bytes.length, 'bytes')
