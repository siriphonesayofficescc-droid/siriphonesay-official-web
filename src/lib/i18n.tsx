import { useSyncExternalStore } from 'react'

/**
 * Minimal i18n: English + Lao. Add a language by adding a column to `dict`
 * and an entry to LANGS. Lao strings should be reviewed by a native speaker.
 */
export type Lang = 'en' | 'lo'
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'lo', label: 'ລາວ' },
]

const dict = {
  // navigation
  'nav.home': ['Home', 'ໜ້າຫຼັກ'],
  'nav.about': ['About Us', 'ກ່ຽວກັບພວກເຮົາ'],
  'nav.services': ['Our Services', 'ບໍລິການ'],
  'nav.projects': ['Projects Portfolio', 'ຜົນງານ'],
  'nav.design': ['Design Your House', 'ອອກແບບເຮືອນ'],
  'nav.experience': ['3D Virtual Experience', 'ປະສົບການ 3D'],
  'nav.estimator': ['Cost Estimator', 'ຄິດໄລ່ລາຄາ'],
  'nav.contact': ['Contact Us', 'ຕິດຕໍ່'],
  'nav.account': ['My designs', 'ແບບຂອງຂ້ອຍ'],
  // configurator
  'cfg.title': ['Design your dream house', 'ອອກແບບເຮືອນໃນຝັນຂອງທ່ານ'],
  'cfg.step': ['Step', 'ຂັ້ນຕອນ'],
  'cfg.next': ['Next', 'ຕໍ່ໄປ'],
  'cfg.back': ['Back', 'ກັບຄືນ'],
  'cfg.save': ['Save', 'ບັນທຶກ'],
  'cfg.saved': ['Saved', 'ບັນທຶກແລ້ວ'],
  'cfg.reset': ['Reset', 'ເລີ່ມໃໝ່'],
  'cfg.share': ['Share link', 'ແບ່ງປັນລິ້ງ'],
  'cfg.pdf': ['Download PDF', 'ດາວໂຫຼດ PDF'],
  'cfg.copied': ['Link copied', 'ສຳເນົາລິ້ງແລ້ວ'],
  'cfg.estimate': ['Preliminary budget', 'ງົບປະມານເບື້ອງຕົ້ນ'],
  'cfg.perm2': ['per m²', 'ຕໍ່ ມ²'],
  'cfg.gfa': ['Floor area', 'ພື້ນທີ່ໃຊ້ສອຍ'],
  'cfg.notQuote': ['Indicative only — not a quotation or approved BOQ.', 'ເປັນພຽງຕົວເລກປະມານ — ບໍ່ແມ່ນໃບສະເໜີລາຄາ.'],
  'cfg.errors': ['Fix these before continuing', 'ກະລຸນາແກ້ໄຂກ່ອນດຳເນີນການຕໍ່'],
  'cfg.warnings': ['Design notes', 'ຂໍ້ສັງເກດ'],
  'cfg.allGood': ['Layout checks passed', 'ແຜນຜັງຜ່ານການກວດສອບ'],
  'view.perspective': ['3D', '3D'],
  'view.front': ['Front', 'ດ້ານໜ້າ'],
  'view.rear': ['Rear', 'ດ້ານຫຼັງ'],
  'view.left': ['Left', 'ດ້ານຊ້າຍ'],
  'view.right': ['Right', 'ດ້ານຂວາ'],
  'view.top': ['Top', 'ດ້ານເທິງ'],
  'view.roof': ['Roof', 'ຫຼັງຄາ'],
  'view.day': ['Day', 'ກາງເວັນ'],
  'view.night': ['Night', 'ກາງຄືນ'],
  'view.floors': ['Floors', 'ຊັ້ນ'],
  'view.all': ['All', 'ທັງໝົດ'],
  'view.cutaway': ['Cutaway', 'ຕັດເບິ່ງພາຍໃນ'],
  'view.explode': ['Explode', 'ແຍກຊັ້ນ'],
  'view.labels': ['Labels', 'ປ້າຍຊື່'],
  'view.hideFront': ['Open front', 'ເປີດດ້ານໜ້າ'],
  'view.roofToggle': ['Roof', 'ຫຼັງຄາ'],
  'view.plan': ['2D plan', 'ແຜນຜັງ 2D'],
  'view.walk': ['Walk inside', 'ຍ່າງເຂົ້າໄປ'],
  'view.exitWalk': ['Exit walkthrough', 'ອອກຈາກໂໝດຍ່າງ'],
  'view.rotate': ['Auto-rotate', 'ໝຸນອັດຕະໂນມັດ'],
  'walk.help': ['W A S D / arrows to move · drag to look · Shift to walk faster', 'W A S D / ລູກສອນ ເພື່ອຍ່າງ · ລາກເພື່ອເບິ່ງ'],
  'quote.title': ['Request a construction quotation', 'ຂໍໃບສະເໜີລາຄາກໍ່ສ້າງ'],
  'quote.send': ['Submit design for quotation', 'ສົ່ງແບບເພື່ອຂໍລາຄາ'],
  'common.loading': ['Loading 3D…', 'ກຳລັງໂຫຼດ 3D…'],
} as const

export type Key = keyof typeof dict

const LS = 'scc.lang'
let lang: Lang = (() => {
  try {
    return (localStorage.getItem(LS) as Lang) || 'en'
  } catch {
    return 'en'
  }
})()
const subs = new Set<() => void>()
export function setLang(l: Lang) {
  lang = l
  try {
    localStorage.setItem(LS, l)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l
  subs.forEach((s) => s())
}
export const useLang = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => lang,
  )

export function useT() {
  const l = useLang()
  const t = (k: Key) => dict[k][l === 'lo' ? 1 : 0]
  /** pick from an object that has label / lo fields */
  const pick = (o: { label: string; lo?: string }) => (l === 'lo' && o.lo ? o.lo : o.label)
  return { t, pick, lang: l }
}
