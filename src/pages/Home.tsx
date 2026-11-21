import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import OrbitStage from '../three/OrbitStage'
import Hero from '../sections/Hero'
import About from '../sections/About'
import Services from '../sections/Services'
import Projects from '../sections/Projects'
import Design from '../sections/Design'
import Capabilities from '../sections/Capabilities'
import WhyUs from '../sections/WhyUs'
import Careers from '../sections/Careers'
import Contact from '../sections/Contact'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useOrbit } from '../lib/orbitStore'

let introShown = false

function IntroOverlay() {
  const ready = useOrbit((s) => s.ready)
  const [done, setDone] = useState(introShown)
  useEffect(() => {
    if (done) return
    const min = setTimeout(() => ready && setDone(true), 900)
    const max = setTimeout(() => setDone(true), 2600)
    return () => {
      clearTimeout(min)
      clearTimeout(max)
    }
  }, [ready, done])
  useEffect(() => {
    if (done) introShown = true
  }, [done])

  return (
    <AnimatePresence>
      {!done && (
        <motion.div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink" exit={{ opacity: 0, transition: { duration: 0.9, ease: 'easeInOut' } }} aria-hidden>
          <motion.img src="/images/site/logo.png" alt="" className="h-20 w-auto" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} />
          <div className="mt-8 h-px w-48 overflow-hidden bg-white/10">
            <motion.div className="h-full bg-gold" initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: 2.2, ease: 'easeInOut' }} />
          </div>
          <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.4em] text-steel">Siriphonesay Construction</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Home() {
  useDocumentMeta()
  const location = useLocation()
  const [heroIn, setHeroIn] = useState(true)
  const [closeIn, setCloseIn] = useState(false)

  // pause the WebGL render loop while opaque sections cover it
  useEffect(() => {
    const hero = document.getElementById('home')
    const contact = document.getElementById('contact')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === hero) setHeroIn(e.isIntersecting)
        if (e.target === contact) setCloseIn(e.isIntersecting)
      })
    })
    if (hero) io.observe(hero)
    if (contact) io.observe(contact)
    return () => io.disconnect()
  }, [])

  // anchor navigation (/#projects etc.), including arrivals from detail pages
  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (!id) return
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [location.hash, location.key])

  return (
    <>
      <IntroOverlay />
      <OrbitStage active={heroIn || closeIn} />
      <main id="main" className="pointer-events-none relative z-10 [&>section:not(#home):not(#contact)]:pointer-events-auto">
        <Hero />
        <About />
        <Services />
        <Projects />
        <Design />
        <Capabilities />
        <WhyUs />
        <Careers />
        <Contact />
      </main>
    </>
  )
}
