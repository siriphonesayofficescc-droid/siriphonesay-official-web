import { useEffect } from 'react'

const BASE = 'Siriphonesay Construction'

export function useDocumentMeta(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE}` : `${BASE} Sole Co., Ltd. | Construction, Civil & Infrastructure Engineering — Vientiane, Lao PDR`
    if (description) {
      let m = document.querySelector('meta[name="description"]')
      if (!m) {
        m = document.createElement('meta')
        m.setAttribute('name', 'description')
        document.head.appendChild(m)
      }
      m.setAttribute('content', description)
    }
  }, [title, description])
}
