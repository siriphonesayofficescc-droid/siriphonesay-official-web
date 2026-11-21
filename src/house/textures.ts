import * as THREE from 'three'
import type { Tex } from './catalog'

/**
 * Procedural PBR-style textures drawn on <canvas> at runtime — no external
 * image downloads, so the designer loads fast and works offline. Each texture
 * represents `tile` metres; geometry UVs are in metres (see worldUV).
 */

const SIZE = 512
const texCache = new Map<string, THREE.CanvasTexture>()
const matCache = new Map<string, THREE.MeshStandardMaterial>()

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)))
  return `#${c.getHexString()}`
}

function noise(g: CanvasRenderingContext2D, r: () => number, amt: number, n = 9000) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(r() * 255)
    g.fillStyle = `rgba(${v},${v},${v},${amt * r()})`
    g.fillRect(r() * SIZE, r() * SIZE, 1 + r() * 2, 1 + r() * 2)
  }
}

function draw(tex: Tex, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const g = c.getContext('2d')!
  const r = rng(tex.length * 977 + color.length * 31 + parseInt(color.slice(1, 7) || '808080', 16) % 9973)
  g.fillStyle = color
  g.fillRect(0, 0, SIZE, SIZE)
  const S = SIZE
  switch (tex) {
    case 'plaster':
      noise(g, r, 0.06, 14000)
      break
    case 'concrete':
    case 'flatRoof':
    case 'polished': {
      for (let i = 0; i < 40; i++) {
        const v = r() > 0.5 ? 255 : 0
        g.fillStyle = `rgba(${v},${v},${v},0.035)`
        g.beginPath()
        g.arc(r() * S, r() * S, 20 + r() * 90, 0, Math.PI * 2)
        g.fill()
      }
      noise(g, r, tex === 'polished' ? 0.04 : 0.1, 16000)
      if (tex === 'concrete') {
        g.strokeStyle = 'rgba(0,0,0,0.12)'
        g.lineWidth = 2
        g.strokeRect(1, 1, S - 2, S / 2 - 1)
        g.strokeRect(1, S / 2, S - 2, S / 2 - 2)
        g.fillStyle = 'rgba(0,0,0,0.25)'
        ;[0.2, 0.8].forEach((x) => [0.25, 0.75].forEach((y) => g.fillRect(x * S - 4, y * S - 4, 8, 8)))
      }
      break
    }
    case 'stone': {
      g.fillStyle = shade(color, -0.25)
      g.fillRect(0, 0, S, S)
      let y = 0
      while (y < S) {
        const h = 50 + r() * 70
        let x = -r() * 80
        while (x < S) {
          const w = 70 + r() * 130
          g.fillStyle = shade(color, (r() - 0.5) * 0.16)
          g.fillRect(x + 4, y + 4, w - 8, h - 8)
          x += w
        }
        y += h
      }
      noise(g, r, 0.12, 12000)
      break
    }
    case 'stack': {
      let y = 0
      while (y < S) {
        const h = 14 + r() * 22
        let x = 0
        while (x < S) {
          const w = 60 + r() * 160
          g.fillStyle = shade(color, (r() - 0.5) * 0.22)
          g.fillRect(x, y, w - 2, h - 2)
          x += w
        }
        y += h
      }
      noise(g, r, 0.1)
      break
    }
    case 'brick': {
      g.fillStyle = '#CFC8BC'
      g.fillRect(0, 0, S, S)
      const bh = S / 8
      for (let row = 0; row < 8; row++) {
        const off = row % 2 ? S / 8 : 0
        for (let x = -off; x < S; x += S / 4) {
          g.fillStyle = shade(color, (r() - 0.5) * 0.14)
          g.fillRect(x + 3, row * bh + 3, S / 4 - 6, bh - 6)
        }
      }
      noise(g, r, 0.1)
      break
    }
    case 'wood':
    case 'woodv':
    case 'parquet': {
      const planks = tex === 'parquet' ? 6 : 8
      const pw = S / planks
      for (let i = 0; i < planks; i++) {
        const base = shade(color, (r() - 0.5) * 0.12)
        const offset = r() * S
        for (let k = 0; k < 2; k++) {
          const y0 = (offset + k * S) % (S * 2) - S
          g.fillStyle = base
          g.fillRect(i * pw, y0, pw, S)
        }
        g.strokeStyle = shade(color, -0.12)
        for (let l = 0; l < 7; l++) {
          g.globalAlpha = 0.25
          g.beginPath()
          const x = i * pw + r() * pw
          g.moveTo(x, 0)
          g.bezierCurveTo(x + (r() - 0.5) * 12, S / 3, x + (r() - 0.5) * 12, (2 * S) / 3, x, S)
          g.stroke()
        }
        g.globalAlpha = 1
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(i * pw, 0, 2, S)
        if (tex === 'parquet') g.fillRect(i * pw, offset % S, pw, 2)
      }
      if (tex !== 'woodv') {
        // rotate so planks run along U for floors / horizontal cladding
        const c2 = document.createElement('canvas')
        c2.width = c2.height = S
        const g2 = c2.getContext('2d')!
        g2.translate(S / 2, S / 2)
        g2.rotate(Math.PI / 2)
        g2.drawImage(c, -S / 2, -S / 2)
        return c2
      }
      break
    }
    case 'acp': {
      noise(g, r, 0.03)
      g.strokeStyle = 'rgba(0,0,0,0.5)'
      g.lineWidth = 4
      g.strokeRect(2, 2, S - 4, S - 4)
      const grad = g.createLinearGradient(0, 0, S, S)
      grad.addColorStop(0, 'rgba(255,255,255,0.08)')
      grad.addColorStop(1, 'rgba(0,0,0,0.08)')
      g.fillStyle = grad
      g.fillRect(0, 0, S, S)
      break
    }
    case 'tile':
    case 'ceramic':
    case 'porcelain': {
      noise(g, r, 0.04)
      const n = tex === 'tile' ? 4 : 1
      g.strokeStyle = shade(color, -0.22)
      g.lineWidth = tex === 'porcelain' ? 2 : 5
      for (let i = 0; i <= n; i++) {
        g.beginPath()
        g.moveTo((i * S) / n, 0)
        g.lineTo((i * S) / n, S)
        g.moveTo(0, (i * S) / n)
        g.lineTo(S, (i * S) / n)
        g.stroke()
      }
      break
    }
    case 'marble': {
      noise(g, r, 0.03)
      for (let v = 0; v < 9; v++) {
        g.strokeStyle = `rgba(110,105,100,${0.12 + r() * 0.25})`
        g.lineWidth = 0.6 + r() * 2.2
        g.beginPath()
        let x = r() * S
        let y = 0
        g.moveTo(x, y)
        while (y < S) {
          x += (r() - 0.5) * 60
          y += 20 + r() * 40
          g.lineTo(x, y)
        }
        g.stroke()
      }
      g.strokeStyle = 'rgba(0,0,0,0.12)'
      g.strokeRect(0, 0, S, S)
      break
    }
    case 'glass': {
      const grad = g.createLinearGradient(0, 0, S, S)
      grad.addColorStop(0, shade(color, 0.15))
      grad.addColorStop(0.5, color)
      grad.addColorStop(1, shade(color, -0.1))
      g.fillStyle = grad
      g.fillRect(0, 0, S, S)
      g.strokeStyle = '#1E1F21'
      g.lineWidth = 10
      g.strokeRect(0, 0, S, S)
      break
    }
    case 'fluted': {
      const n = 12
      for (let i = 0; i < n; i++) {
        const grad = g.createLinearGradient((i * S) / n, 0, ((i + 1) * S) / n, 0)
        grad.addColorStop(0, shade(color, -0.12))
        grad.addColorStop(0.5, shade(color, 0.08))
        grad.addColorStop(1, shade(color, -0.12))
        g.fillStyle = grad
        g.fillRect((i * S) / n, 0, S / n, S)
      }
      break
    }
    case 'clayTile':
    case 'concreteTile':
    case 'shingle': {
      const rows = 6
      const rh = S / rows
      for (let row = 0; row < rows; row++) {
        const cols = tex === 'shingle' ? 5 : 4
        const off = row % 2 ? S / cols / 2 : 0
        for (let i = -1; i < cols; i++) {
          const x = i * (S / cols) + off
          const grad = g.createLinearGradient(x, 0, x + S / cols, 0)
          const b = shade(color, (r() - 0.5) * 0.12)
          grad.addColorStop(0, shade(b, -0.15))
          grad.addColorStop(0.5, shade(b, tex === 'shingle' ? 0 : 0.1))
          grad.addColorStop(1, shade(b, -0.15))
          g.fillStyle = grad
          g.fillRect(x + 1, row * rh, S / cols - 2, rh - 3)
        }
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(0, row * rh + rh - 4, S, 4)
      }
      break
    }
    case 'metal': {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = shade(color, 0.12)
        g.fillRect((i * S) / 4, 0, 6, S)
        g.fillStyle = 'rgba(0,0,0,0.3)'
        g.fillRect((i * S) / 4 + 6, 0, 3, S)
      }
      noise(g, r, 0.03)
      break
    }
  }
  return c
}

export function texture(tex: Tex, color: string): THREE.CanvasTexture {
  const key = `${tex}|${color}`
  let t = texCache.get(key)
  if (!t) {
    t = new THREE.CanvasTexture(draw(tex, color))
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    texCache.set(key, t)
  }
  return t
}

export interface MatOpts {
  tex: Tex
  color: string
  roughness: number
  metalness?: number
  tile: number
  transparent?: boolean
  opacity?: number
  side?: THREE.Side
}

/** Shared material per (texture, colour, tile) — cached so many walls reuse one material. */
export function material(o: MatOpts): THREE.MeshStandardMaterial {
  const key = `${o.tex}|${o.color}|${o.roughness}|${o.metalness ?? 0}|${o.tile}|${o.opacity ?? 1}|${o.side ?? 0}`
  let m = matCache.get(key)
  if (!m) {
    const map = texture(o.tex, o.color).clone()
    map.needsUpdate = true
    map.repeat.set(1 / o.tile, 1 / o.tile)
    m = new THREE.MeshStandardMaterial({
      map,
      roughness: o.roughness,
      metalness: o.metalness ?? 0,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    })
    matCache.set(key, m)
  }
  return m
}

export function flatMaterial(color: string, roughness = 0.6, metalness = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = `flat|${color}|${roughness}|${metalness}|${JSON.stringify(extra)}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
    matCache.set(key, m)
  }
  return m
}

/**
 * Planar UVs in metres, chosen per-vertex from the face normal. `offset`
 * (the mesh's position) keeps tiling continuous between neighbouring pieces.
 */
export function worldUV(geo: THREE.BufferGeometry, offset: [number, number, number] = [0, 0, 0]) {
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offset[0]
    const y = pos.getY(i) + offset[1]
    const z = pos.getZ(i) + offset[2]
    const nx = Math.abs(nor.getX(i))
    const ny = Math.abs(nor.getY(i))
    const nz = Math.abs(nor.getZ(i))
    if (ny >= nx && ny >= nz) {
      uv[i * 2] = x
      uv[i * 2 + 1] = z
    } else if (nx >= nz) {
      uv[i * 2] = z
      uv[i * 2 + 1] = y
    } else {
      uv[i * 2] = x
      uv[i * 2 + 1] = y
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

export function boxGeo(w: number, h: number, d: number, pos: [number, number, number]) {
  return worldUV(new THREE.BoxGeometry(w, h, d), pos)
}
