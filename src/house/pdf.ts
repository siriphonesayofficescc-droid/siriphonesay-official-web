import { jsPDF } from 'jspdf'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ceilings, doorTypes, exteriorThemes, featureWalls, fenceTypes, findMat, floorMaterials, frameMaterials, furnitureDef, glassTypes,
  interiorThemes, lightingOptions, roofMaterials, roomSpec, stairFinishes, styles, wallMaterials,
} from './catalog'
import { company } from '../content/company'
import { estimateDesign, money, type Currency } from './estimate'
import FloorPlan2D from './FloorPlan2D'
import { generateLayout } from './layout'
import type { Design } from './types'

/**
 * Downloadable design summary (PDF). English text (the PDF core fonts do not
 * include Lao glyphs). Clearly marked as a CONCEPT and PRELIMINARY BUDGET.
 */

async function svgToPng(svg: string, w: number, h: number): Promise<string> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('plan render failed'))
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function downloadDesignPdf(d: Design, opts: { images: string[]; currency: Currency; customer?: { name?: string; email?: string; phone?: string } }) {
  const layout = generateLayout(d)
  const est = estimateDesign(d, undefined, layout)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW = 210
  const M = 16
  let y = 0
  const gold: [number, number, number] = [142, 116, 68]
  const ink: [number, number, number] = [20, 20, 22]

  const header = (title: string) => {
    doc.setFillColor(10, 10, 11)
    doc.rect(0, 0, PW, 22, 'F')
    doc.setTextColor(228, 210, 166)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(company.name.toUpperCase(), M, 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(185, 189, 196)
    doc.text(`${title}  ·  Ref ${d.ref}`, M, 16)
    doc.text(`${company.contact.phone}  ·  ${company.contact.email}`, PW - M, 16, { align: 'right' })
    y = 32
  }
  const footer = () => {
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text('CONCEPT DESIGN — not for construction. Indicative visualisation; not an approved architectural or structural drawing.', M, 289)
    doc.text(`Page ${doc.getNumberOfPages()}`, PW - M, 289, { align: 'right' })
  }
  const h2 = (t: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...gold)
    doc.text(t.toUpperCase(), M, y)
    doc.setDrawColor(...gold)
    doc.line(M, y + 1.5, PW - M, y + 1.5)
    y += 7
    doc.setTextColor(...ink)
  }
  const row = (k: string, v: string, x = M, w = PW - 2 * M) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(110)
    doc.text(k, x, y)
    doc.setTextColor(...ink)
    const lines = doc.splitTextToSize(v, w - 48)
    doc.text(lines, x + 48, y)
    y += 4.6 * Math.max(1, lines.length)
  }
  const need = (h: number) => {
    if (y + h > 280) {
      footer()
      doc.addPage()
      header('Design summary (continued)')
    }
  }

  /* page 1 — cover */
  header('House design summary')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...ink)
  doc.text(d.name, M, y + 4)
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  const st = styles.find((s) => s.id === d.style)
  doc.text(`${st?.label ?? d.style}  ·  ${d.floors} floor(s)  ·  ${est.gfa.toFixed(0)} m² gross floor area  ·  ${new Date().toLocaleDateString('en-GB')}`, M, y)
  y += 6
  if (opts.images[0]) {
    doc.addImage(opts.images[0], 'JPEG', M, y, PW - 2 * M, (PW - 2 * M) * 0.56)
    y += (PW - 2 * M) * 0.56 + 4
  }
  if (opts.images.length > 1) {
    const w = (PW - 2 * M - 4) / 2
    opts.images.slice(1, 3).forEach((img, i) => doc.addImage(img, 'JPEG', M + i * (w + 4), y, w, w * 0.56))
    y += w * 0.56 + 6
  }
  h2('Project information')
  row('Project reference', d.ref)
  if (opts.customer?.name) row('Customer', `${opts.customer.name}${opts.customer.email ? ' · ' + opts.customer.email : ''}${opts.customer.phone ? ' · ' + opts.customer.phone : ''}`)
  row('Land', `${d.land.w} × ${d.land.l} m (${(d.land.w * d.land.l).toFixed(0)} m²)`)
  row('Building', `${d.building.w} × ${d.building.l} m footprint · ${d.floors} floor(s) · ceiling ${d.ceiling} m`)
  row('Roof', `${d.roof.type} roof${d.roof.type !== 'flat' ? `, ${d.roof.pitch}° pitch` : ''}, ${d.roof.overhang} m overhang`)
  row('Preliminary budget', `${money(est.total, opts.currency)} — indicative only`)
  row('House construction', `${money(est.houseTotal, opts.currency)}  (${money(est.perM2, opts.currency)} per m² of floor area)`)
  row('Site, outdoor & furniture', money(est.extrasTotal, opts.currency))
  footer()

  /* renders gallery */
  if (opts.images.length > 3) {
    doc.addPage()
    header('3D renders')
    const w = (PW - 2 * M - 4) / 2
    const hh = w * 0.5625
    opts.images.slice(3).forEach((img, i) => {
      const cx = M + (i % 2) * (w + 4)
      const cy = y + Math.floor(i / 2) * (hh + 5)
      doc.addImage(img, 'JPEG', cx, cy, w, hh)
    })
    footer()
  }

  /* page 2 — floor plans & schedule */
  doc.addPage()
  header('Floor plans & room schedule')
  const planW = d.floors === 1 ? PW - 2 * M : (PW - 2 * M - 6) / 2
  const aspect = (layout.L + 3.2) / (layout.W + 3.2)
  const planH = Math.min(110, planW * aspect)
  const pw = planH / aspect
  for (let f = 0; f < d.floors; f++) {
    const svg = renderToStaticMarkup(createElement(FloorPlan2D, { d, layout, floor: f, theme: 'light' }))
      .replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(pw * 8)}" height="${Math.round(planH * 8)}"`)
    const png = await svgToPng(svg, Math.round(pw * 8), Math.round(planH * 8))
    const col = f % 2
    if (f === 2) y += planH + 10
    const x = M + col * (planW + 6) + (planW - pw) / 2
    doc.setFontSize(8)
    doc.setTextColor(...gold)
    doc.text(`FLOOR ${f + 1}`, M + col * (planW + 6), (f === 2 ? y : 32) + 2)
    doc.addImage(png, 'PNG', x, (f === 2 ? y : 32) + 4, pw, planH)
  }
  y = 32 + planH + 10 + (d.floors === 3 ? planH + 10 : 0)
  need(30)
  h2('Room schedule')
  layout.floors.forEach((rooms, f) => {
    rooms.forEach((r) => {
      need(6)
      const label = d.roomOverrides[r.id]?.name || (r.type === 'stair' ? 'Stair' : roomSpec(r.type).label)
      row(`Floor ${f + 1}`, `${label} — ${(r.x1 - r.x0).toFixed(1)} × ${(r.z1 - r.z0).toFixed(1)} m (${((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(1)} m²)`)
    })
  })
  footer()

  /* page 3 — specifications & budget */
  doc.addPage()
  header('Specifications & preliminary budget')
  h2('Exterior selections')
  const ext = d.exterior
  row('Exterior theme', exteriorThemes.find((t) => t.wall === ext.wallColor)?.label ?? 'Custom colours')
  row('Wall finish', findMat(wallMaterials, ext.wall).label)
  row('Accent material', findMat(wallMaterials, ext.accent).label)
  row('Roof covering', findMat(roofMaterials, ext.roof).label)
  row('Window frames', findMat(frameMaterials, ext.frame).label)
  row('Glass', glassTypes.find((g) => g.id === ext.glass)?.label ?? ext.glass)
  row('Main door', doorTypes.find((g) => g.id === ext.door)?.label ?? ext.door)
  row('Fence & gate', fenceTypes.find((g) => g.id === ext.fence)?.label ?? ext.fence)
  row('Site', `${d.parking} parking space(s) · ${d.balcony.enabled ? `balcony ${d.balcony.depth} m deep` : 'no balcony'} · ${d.extras.pool ? `pool ${d.extras.poolSize.join(' × ')} m` : 'no pool'} · ${d.extras.garden ? `garden with ${d.extras.trees} trees` : 'no garden'}`)
  y += 3
  h2('Interior selections')
  const it = d.interior
  row('Interior theme', interiorThemes.find((t) => t.id === it.theme)?.label ?? it.theme)
  row('Living floors', findMat(floorMaterials, it.floorLiving).label)
  row('Bedroom floors', findMat(floorMaterials, it.floorBed).label)
  row('Wet-area floors', findMat(floorMaterials, it.floorWet).label)
  row('Feature wall', featureWalls.find((x) => x.id === it.featureWall)?.label ?? '-')
  row('Ceilings', ceilings.find((x) => x.id === it.ceiling)?.label ?? '-')
  row('Staircase', stairFinishes.find((x) => x.id === it.stairFinish)?.label ?? '-')
  row('Lighting', lightingOptions.find((x) => x.id === it.lighting)?.label ?? '-')
  const furn = new Map<string, number>()
  d.furniture.forEach((f) => furn.set(f.kind, (furn.get(f.kind) ?? 0) + 1))
  row('Furniture', [...furn.entries()].map(([k, n]) => `${furnitureDef(k)?.label ?? k} ×${n}`).join(', ') || 'None')
  y += 3
  need(90)
  h2(`Preliminary construction budget (${opts.currency})`)
  est.lines.forEach((l, i) => {
    need(6)
    doc.setFontSize(8.5)
    doc.setTextColor(...ink)
    doc.text(`${String(i + 1).padStart(2, '0')}  ${l.label}`, M, y)
    doc.text(money(l.usd, opts.currency), PW - M, y, { align: 'right' })
    y += 4.8
  })
  doc.setDrawColor(...gold)
  doc.line(M, y - 2, PW - M, y - 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Estimated total', M, y + 3)
  doc.text(money(est.total, opts.currency), PW - M, y + 3, { align: 'right' })
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)
  doc.text(`House construction ${money(est.houseTotal, opts.currency)} (${money(est.perM2, opts.currency)}/m²)  ·  Site, outdoor & furniture ${money(est.extrasTotal, opts.currency)}`, M, y)
  y += 8
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(110)
  const disc = doc.splitTextToSize(
    'This is a PRELIMINARY BUDGET INDICATION generated automatically from the selections above. It is not a quotation and not an approved Bill of Quantities. Final pricing will be prepared and approved by the Siriphonesay Construction estimating team after review of architectural, structural and site requirements. Prices exclude land, permits and design fees unless stated.',
    PW - 2 * M,
  )
  doc.text(disc, M, y)
  footer()
  doc.save(`${d.ref}-${d.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`)
}
