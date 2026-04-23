"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import { useState, useEffect, useRef, useCallback } from "react"
import { PixelBird } from "@/components/PixelBird"

const DitherMap = dynamic(() => import("@/components/dither-map"), { ssr: false })

// ─── Story data for each seagull ──────────────────────────────────────────────
const BIRD_STORIES = [
  {
    blurb: "The ticks and taps in AUTOPILOT signify the passage of time, speaking to viewers entirely through sound design with no dialogue. Inspired by Hans Zimmer\u2019s \u201cMountains\u201d from Interstellar\u2019s Miller\u2019s Planet scene.",
    href: "https://www.youtube.com/watch?v=cIT6DwpHqmQ&feature=youtu.be",
    linkText: "Watch AUTOPILOT",
    audioSrc: "/hans-zimmer-mountains.mp3",   // ← add this file to /public
    audioTitle: "Mountains",
    audioArtist: "Hans Zimmer",
  },
  {
    blurb: "\u201cAll It Takes Is an Idea\u201d captures the creative process in three stages: struggle, breakthrough, and flow. The acapella group serves as the visual and auditory anchor \u2014 their formation tightens, the lighting shifts from cold to warm, and the lyrics intensify.",
    href: "https://www.instagram.com/p/DTlKsQcjs3N/",
    linkText: "Watch All It Takes Is an Idea",
    audioSrc: "/feel-it-still.wav",
    audioTitle: "Feel It Still",
    audioArtist: "Portugal. The Man",
  },
  {
    blurb: "From my trip to Peru, inspired by Gawx's travel work and scored to Chopin's Piano Concerto No. 1 in E minor. I experimented with purely static shots — the stillness adds a layer of drama and calm that lets you sit with each moment.",
    href: "https://www.youtube.com/watch?v=QRDFGvcxUOM",
    linkText: "Watch Peru",
    audioSrc: "/chopin-piano-concerto.mp3",   // ← add this file to /public
    audioTitle: "Piano Concerto No. 1, Op. 11: II",
    audioArtist: "Frédéric Chopin",
  },
]

const CITY_NAMES = ["Ann Arbor", "Chicago", "Boston", "Istanbul", "College Station", "Waterloo", "San Diego"]

const CITY_TEXT = [
  "My city of birth. ~Infant. No thoughts. Survival mode.",
  "Navy Pier was my childhood. Willis or Sears Tower? She is the Windy City indeed. ~Elementary school. Lil devious fella. Peak soccer motive.",
  "Park ya caaaaahr in Boaston. ~Middle school. Peak Kumon and Russian Math era. Truly traumatic.",
  "Superb transit, friendliest people, elite food. Romanticize life while casually ferrying across continents to school. Ah, it do be the little things. ~High school. Turkish education system sucks btw, one exam defines your entire life trajectory. Was the perfect excuse to explore my city. Hence the map. I\u00A0\u00A0\u00A0love\u00A0\u00A0\u00A0maps. I'd argue I have impeccable spatial awareness.",
  "It's a college town. Everyone and their mom is somehow affiliated to A&M. Go Aggies. ~12th grade. Turkish system didn't cut it, had to crawl back to the land of opportunity in case my grades weren't good enough. They were. I did it, mom.",
  "The people here changed me. ~University. Started in kinesiology, ended with a burning desire to pursue media and tell stories. Felt like I lived five different lives. Identity crisis, isolation, breakthrough, flow.",
  "City of families and retirees. Cliffs and seals. Clearest dunes an hour east, rent a Jeep and go drifting. ~Mid-uni. Vibes.",
]

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const FLOWER_CHARS = ["✿", "❀", "✽", "✾", "✤", "❁"]



// ─── Split city text at ~ for partial italic formatting ────────────────────────
function CityCaption({ text }: { text: string }) {
  const tilde = text.indexOf("~")
  if (tilde === -1) return <span className="text-[16px]">{text}</span>
  return (
    <>
      <span className="text-[16px]">{text.slice(0, tilde).trim()}</span>
      <span className="block mt-2 text-[13px] text-[#E7E7D0]/60">{text.slice(tilde)}</span>
    </>
  )
}

// ─── CityName ─────────────────────────────────────────────────────────────────
function CityName({
  name, onFirstLetter, onComplete,
}: {
  name: string; onFirstLetter?: () => void; onComplete?: () => void
}) {
  const [displayed, setDisplayed] = useState(name)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firedFirst = useRef(false)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    firedFirst.current = false
    let frame = 0
    const framesPerLetter = 5
    const totalFrames = name.length * framesPerLetter

    intervalRef.current = setInterval(() => {
      frame++
      const lettersRevealed = Math.floor(frame / framesPerLetter)
      if (lettersRevealed >= 1 && !firedFirst.current) {
        firedFirst.current = true
        onFirstLetter?.()
      }
      setDisplayed(
        name.split("").map((char, i) => {
          if (char === " ") return " "
          if (i < lettersRevealed) return char
          return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
        }).join("")
      )
      if (frame >= totalFrames) {
        setDisplayed(name)
        if (intervalRef.current) clearInterval(intervalRef.current)
        onComplete?.()
      }
    }, 55)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [name])

  return (
    <span className="text-[15px] tracking-widest uppercase text-[#E7E7D0]/70 font-light">
      {displayed}
    </span>
  )
}

// ─── NefiseName ───────────────────────────────────────────────────────────────
function NefiseName() {
  const [showTip, setShowTip] = useState(false)
  return (
    <span className="relative inline">
      <span
        className="font-semibold cursor-default"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        style={{
          background: "linear-gradient(transparent 55%, rgba(231,231,208,0.28) 55%)",
          paddingLeft: "1px", paddingRight: "1px",
        }}
      >
        Nefise
      </span>
      {showTip && (
        <span className="absolute left-0 -top-7 text-[12px] italic text-[#E7E7D0]/75 bg-[#283238] border border-[#E7E7D0]/10 px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-10">
          pronounced Nefis-eh
        </span>
      )}
    </span>
  )
}

// ─── WorkLink — cursor-following image preview ────────────────────────────────
function WorkLink({
  href, preview, previewWidth = 240, className, children,
}: {
  href: string; preview: string | null; previewWidth?: number; className: string; children: React.ReactNode
}) {
  const [visible, setVisible] = useState(false)
  const posRef = useRef({ x: 0, y: 0 })
  const previewRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback((clientX: number, clientY: number) => {
    posRef.current = { x: clientX, y: clientY }
    if (previewRef.current) {
      const vw = window.innerWidth
      const pw = previewWidth
      const left = clientX + 18
      previewRef.current.style.left = (left + pw > vw ? clientX - pw - 10 : left) + "px"
      previewRef.current.style.top = (clientY - 80) + "px"
    }
  }, [previewWidth])

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onMouseEnter={(e) => { updatePos(e.clientX, e.clientY); setVisible(true) }}
        onMouseLeave={() => setVisible(false)}
        onMouseMove={(e) => updatePos(e.clientX, e.clientY)}
      >
        {children}
      </a>
      {preview && visible && (
        <div
          ref={previewRef}
          className="fixed pointer-events-none z-50"
          style={{ left: posRef.current.x + 18, top: posRef.current.y - 80 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" style={{ display: "block", width: previewWidth, borderRadius: 4 }} className="shadow-2xl" />
        </div>
      )}
    </>
  )
}

// ─── FlowerSparkles ───────────────────────────────────────────────────────────
interface Flower { id: number; x: number; y: number; char: string }

function FlowerSparkles() {
  const [flowers, setFlowers] = useState<Flower[]>([])
  const counterRef = useRef(0)
  const lastFireRef = useRef(0)
  const lastPosRef = useRef({ x: -999, y: -999 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      const dx = e.clientX - lastPosRef.current.x
      const dy = e.clientY - lastPosRef.current.y
      if (now - lastFireRef.current < 130 || Math.sqrt(dx * dx + dy * dy) < 28) return
      lastFireRef.current = now
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      const id = counterRef.current++
      const char = FLOWER_CHARS[Math.floor(Math.random() * FLOWER_CHARS.length)]
      setFlowers(prev => [...prev.slice(-10), { id, x: e.clientX + (Math.random() - 0.5) * 22, y: e.clientY, char }])
      setTimeout(() => setFlowers(prev => prev.filter(f => f.id !== id)), 900)
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  return (
    <>
      <style>{`
        @keyframes flowerFloat {
          0%   { opacity:0.75; transform:translate(-50%,-50%) scale(1.1); }
          100% { opacity:0;    transform:translate(-50%,-300%) scale(0.5); }
        }
      `}</style>
      {flowers.map(f => (
        <div key={f.id} className="fixed pointer-events-none z-40 text-[#E7E7D0]/65 text-[14px] select-none"
          style={{ left: f.x, top: f.y, animation: "flowerFloat 0.9s ease-out forwards" }}>
          {f.char}
        </div>
      ))}
    </>
  )
}


// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const [cityIndex, setCityIndex] = useState(0)
  const [captionVisible, setCaptionVisible] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [advanceTrigger, setAdvanceTrigger] = useState(0)

  useEffect(() => { setCaptionVisible(false) }, [cityIndex])

  const linkClass = "underline underline-offset-2 decoration-[#E7E7D0]/50 hover:decoration-[#E7E7D0]"

  return (
    <div className="bg-[#36454F] flex flex-col md:flex-row md:h-screen text-[#E7E7D0]">

      <FlowerSparkles />

      {/* Seagull flock — fixed, desktop only */}
      <div className="hidden md:block">
        <PixelBird positionClass="top-[4%] left-[2%]"  startSeq={0} story={BIRD_STORIES[0]} />
        <PixelBird positionClass="top-[8%] left-[19%]" startSeq={3} story={BIRD_STORIES[1]} />
        <PixelBird positionClass="top-[6%] left-[31%]" startSeq={6} story={BIRD_STORIES[2]} />
      </div>

      {/* LEFT (desktop) / bottom (mobile) — map + city info */}
      <div
        className="order-2 md:order-1 md:w-[42%] md:h-full flex items-center justify-center px-8 py-10 md:p-0"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onClick={() => setAdvanceTrigger(t => t + 1)}
        style={{ cursor: "default" }}
      >
        <div className="w-full md:w-[84%] md:ml-auto md:mr-6">

          {/* Mobile-only birds — inline, scrolls with page, sits between contacts and map */}
          <div className="md:hidden flex items-end gap-5 mb-4">
            <PixelBird inline startSeq={0} story={BIRD_STORIES[0]} />
            <PixelBird inline startSeq={3} story={BIRD_STORIES[1]} />
            <PixelBird inline startSeq={6} story={BIRD_STORIES[2]} />
          </div>

          <p className="text-[13px] italic font-medium text-[#E7E7D0]/55 mb-1 text-right">
            enjoy this little atlas of cities I&apos;ve called home
          </p>
          <div className="w-full aspect-video md:aspect-auto md:h-[42vh]">
            <DitherMap
              mapTextureSrc="/annarbor.jpeg"
              mapTextureSrc2="/chicago-map.png"
              mapTextureSrc3="/boston-map.png"
              mapTextureSrc4="/istanbul-map.png"
              mapTextureSrc5="/collegestation.jpeg"
              mapTextureSrc6="/waterloo-map.png"
              mapTextureSrc7="/sandiego-map.png"
              mapSwitchInterval={8000}
              onMapChange={setCityIndex}
              waveColor={[0.906, 0.906, 0.816]}
              backgroundColor={[0.212, 0.271, 0.310]}
              waveSpeed={0.06}
              waveFrequency={3.5}
              waveAmplitude={0.45}
              colorNum={4}
              pixelSize={1}
              enableMouseInteraction={true}
              mouseRadius={0.3}
              paused={isPaused}
              advanceTrigger={advanceTrigger}
            />
          </div>

          <div className="mt-2">
            <CityName
              name={CITY_NAMES[cityIndex]}
              onFirstLetter={() => setCaptionVisible(true)}
            />
          </div>

          <p
            className="text-[14px] font-medium text-[#E7E7D0]/75 mt-1 max-w-full leading-snug transition-opacity duration-500"
            style={{ opacity: captionVisible ? 1 : 0 }}
          >
            <CityCaption text={CITY_TEXT[cityIndex]} />
          </p>
          <p className="text-[12px] text-[#E7E7D0]/45 font-medium mt-1 italic">click →</p>
        </div>
      </div>

      {/* RIGHT (desktop) / top (mobile) — content */}
      <div className="order-1 md:order-2 md:w-[58%] md:h-full flex items-center justify-center">
        <div className="max-w-[520px] w-full px-8 py-16 md:py-0">

          {/* Profile + Bio */}
          <div className="flex gap-5 items-start mb-7">
            <Image src="/profile.png" alt="Nefise" width={80} height={80}
              className="w-20 h-20 object-cover grayscale flex-shrink-0" />
            <p className="text-[17px] leading-snug pt-1">
              Hi, my name is <NefiseName /><span className="font-semibold"> Akcakir</span>. I&apos;m drawn to stories worth telling.
            </p>
          </div>

          {/* Past work — section 1 */}
          <div className="mb-7">
            <p className="text-[17px] font-bold mb-2">In the past, I&hellip;</p>
            <div className="space-y-1 text-[17px] leading-snug">
              <p>
                Sold out{" "}
                <WorkLink href="https://x.com/socraticainfo/status/2036601353590517956?s=20" preview="/socratica symposium.JPEG" className={linkClass}>
                  Socratica Symposium
                </WorkLink>
                {" "}(directed{" "}
                <WorkLink href="https://x.com/socraticainfo/status/2033651254719574392?s=20" preview="/launch video.png" className={linkClass}>
                  launch video
                </WorkLink>
                {" "}and{" "}
                <WorkLink href="https://www.instagram.com/p/DTlKsQcjs3N/" preview="/preview-teaser.png" className={linkClass}>
                  teaser
                </WorkLink>
                ).
              </p>
              <p>
                Community building at{" "}
                <WorkLink href="https://socratica.info/" preview="/socratica.png" className={linkClass}>
                  Socratica
                </WorkLink>
                .
              </p>
              <p>
                Led design for{" "}
                <WorkLink href="https://apps.apple.com/ca/app/markaz/id6758658836" preview="/markaz.png" previewWidth={120} className={linkClass}>
                  Markaz
                </WorkLink>
                , a community platform for Muslim events and professionals.
              </p>
            </div>
          </div>

          {/* Past work — section 2 */}
          <div className="mb-7">
            <p className="text-[17px] font-bold mb-2">I&apos;ve enjoyed working on&hellip;</p>
            <div className="space-y-1 text-[17px] leading-snug">
              <p>
                Made a{" "}
                <WorkLink href="https://youtu.be/cIT6DwpHqmQ?si=U88zUtcWnwEqMP6R" preview="/short film.png" className={linkClass}>
                  short film
                </WorkLink>
                {" "}about my story snapping out of <em>Autopilot</em>.
              </p>
              <p>
                Filmed a mini{" "}
                <WorkLink href="https://youtu.be/fbIqNpvAsdE?si=iMeVz6q-vyN3t_v5" preview="/documentary .jpeg" className={linkClass}>
                  documentary
                </WorkLink>
                {" "}about a science illustrator who turns anatomy and evolution into art.
              </p>
              <p>
                Documented my trip to{" "}
                <WorkLink href="https://youtu.be/QRDFGvcxUOM?si=BgFe8LhrPLEN2pIp" preview="/Peru.png" className={linkClass}>
                  Peru
                </WorkLink>
                .
              </p>
            </div>
          </div>

          {/* Currently */}
          <div className="mb-7">
            <p className="text-[17px] font-bold mb-2">Currently</p>
            <p className="text-[17px] leading-snug">
              Graduating from Kinesiology at the{" "}
              <WorkLink href="https://uwaterloo.ca/news/igniting-spark-inside-socraticas-creative-community" preview="/Screenshot 2026-04-20 at 2.12.41 PM.png" className={linkClass}>
                <em>University of Waterloo</em>
              </WorkLink>
              .
            </p>
          </div>

          {/* Contacts */}
          <div className="flex gap-5 text-[17px]">
            <a href="https://x.com/nef_isa" target="_blank" rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-[#E7E7D0]/50 hover:decoration-[#E7E7D0] text-[#E7E7D0]/70 hover:text-[#E7E7D0] transition-colors">
              twitter
            </a>
            <a href="mailto:nefise.akcakir@gmail.com"
              className="underline underline-offset-2 decoration-[#E7E7D0]/50 hover:decoration-[#E7E7D0] text-[#E7E7D0]/70 hover:text-[#E7E7D0] transition-colors">
              email
            </a>
            <a href="https://www.linkedin.com/in/nefise-akcakir" target="_blank" rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-[#E7E7D0]/50 hover:decoration-[#E7E7D0] text-[#E7E7D0]/70 hover:text-[#E7E7D0] transition-colors">
              linkedin
            </a>
            <a href="https://www.youtube.com/@bynefise/videos" target="_blank" rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-[#E7E7D0]/50 hover:decoration-[#E7E7D0] text-[#E7E7D0]/70 hover:text-[#E7E7D0] transition-colors">
              youtube
            </a>
          </div>

          {/* Mini note */}
          <p className="mt-4 text-[13px] font-light leading-relaxed text-[#E7E7D0]/55">
            if you have an interesting story to share, email me at{" "}
            <a href="mailto:nefise.akcakir@gmail.com"
              className="underline underline-offset-2 decoration-[#E7E7D0]/40 hover:decoration-[#E7E7D0]/70 transition-colors">
              nefise.akcakir@gmail.com
            </a>
            {" "}&mdash; ps i love a good convo over coffee
          </p>

        </div>
      </div>

    </div>
  )
}
