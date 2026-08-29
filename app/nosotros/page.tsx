import Link from "next/link"
import { ArrowLeft, BookOpen, ShieldCheck, Users, Scale } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Nosotros — Proxie.cards",
  description: "Sobre Proxie.cards: el juego, la comunidad y nuestra filosofia. Que son los proxies, por que los hacemos, y nuestra postura etica.",
}

export default function NosotrosPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full bg-[#0a0b10] sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#0a0b10] border-b border-white/10 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-bold tracking-widest uppercase text-accent-blue mb-3">Sobre nosotros</p>
          <h1 
            className="text-4xl md:text-5xl text-white leading-tight mb-4 uppercase font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            El juego, la comunidad y nuestra filosofia
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Creemos en el valor de jugar. Las mejores experiencias ocurren en la mesa, probando estrategias, compartiendo y descubriendo nuevas mecanicas.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="bg-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          
          {/* Section: Que son los proxies */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 flex items-center justify-center bg-accent-blue text-white">
                <BookOpen className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold text-black uppercase" style={{ fontFamily: "var(--font-display)" }}>
                Que son exactamente los PROXIES?
              </h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Los PROXIES son cartas de prueba o sustitutos no oficiales de las cartas originales. Sirven como representaciones funcionales que permiten a los jugadores simular la presencia y los efectos de una carta real durante una partida. Su uso en entornos casuales es una practica completamente licita, transparente y reconocida por la comunidad y los propios creadores del juego.
            </p>
          </section>

          {/* Section: Por que hacemos proxies */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 flex items-center justify-center bg-accent-blue text-white">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold text-black uppercase" style={{ fontFamily: "var(--font-display)" }}>
                Por que hacemos PROXIES?
              </h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Creemos en el valor de jugar. Las mejores experiencias ocurren en la mesa, probando estrategias, compartiendo y descubriendo nuevas mecanicas. Sin embargo, el factor economico muchas veces puede convertirse en una barrera que aleja a jugadores apasionados de la experiencia completa del juego.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Nuestra vision es sencilla: los PROXIES son herramientas de transicion y testeo. Le permiten al jugador mantenerse activo en la comunidad y, en un futuro, cuando sus posibilidades se lo permitan, adquirir las cartas oficiales para apoyar a los creadores que hacen posible este universo.
            </p>
          </section>

          {/* Section: Proxies vs Falsificaciones */}
          <section className="mb-16 bg-[#0a0b10] p-8 -mx-6 md:mx-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 flex items-center justify-center bg-accent-blue text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold text-white uppercase" style={{ fontFamily: "var(--font-display)" }}>
                La linea clara: PROXIES vs. Falsificaciones
              </h2>
            </div>
            <p className="text-white/70 leading-relaxed mb-4">
              Para nosotros, la etica en el juego es innegociable. Existe una diferencia abismal entre los PROXIES y las falsificaciones (o counterfeits). Una falsificacion busca enganar; intenta hacerse pasar por una carta real para obtener una ventaja economica o alterar el mercado secundario. <strong className="text-white">Nosotros estamos categoricamente en contra de esas practicas.</strong>
            </p>
            <p className="text-white/70 leading-relaxed mb-4">
              Los PROXIES, por el contrario, son herramientas transparentes de playtesting. Para evidenciar esto y garantizar que nuestras cartas nunca puedan ser confundidas con un producto oficial, en Proxie.cards imprimimos nuestras cartas exclusivamente de un solo lado, dejando el reverso en blanco y con nuestro logo. Asi, dejamos en claro desde el primer vistazo que se trata de material de prueba.
            </p>
            <p className="text-white/70 leading-relaxed">
              Esta filosofia respeta la vision de los propios creadores del juego. Tal como se detalla en los anuncios oficiales sobre politicas y comunicacion, existe una distincion fundamental entre proteger a la comunidad de las falsificaciones comerciales y comprender el uso de cartas de prueba en entornos personales y no oficiales.
            </p>
          </section>

          {/* Section: Politicas de uso */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 flex items-center justify-center bg-accent-blue text-white">
                <Scale className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold text-black uppercase" style={{ fontFamily: "var(--font-display)" }}>
                Politicas de uso y el acuerdo en la mesa
              </h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-6">
              Queremos ser absolutamente transparentes sobre donde y como deben usarse nuestras cartas. El uso de PROXIES conlleva una responsabilidad hacia los demas jugadores:
            </p>
            
            <div className="space-y-4">
              <div className="border-l-4 border-accent-blue pl-4">
                <h3 className="font-bold text-black mb-1">El acuerdo social previo</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  El uso de PROXIES requiere total transparencia. Es fundamental que el jugador aclare que los utilizara antes de empezar la partida y se asegure de que todos los integrantes de la mesa esten de acuerdo con ello. El respeto por el grupo y la sana competencia es lo primero.
                </p>
              </div>
              
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-bold text-black mb-1">Cero validez en torneos legales</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Nuestras cartas no son validas, ni legales, ni estan permitidas en ningun torneo oficial o evento en el cual se disponga de un premio. Si vas a competir en un circuito oficial, deberas utilizar exclusivamente cartas autenticas.
                </p>
              </div>
            </div>

            <p className="text-gray-700 leading-relaxed mt-6">
              En Proxie.cards celebramos el juego en su estado mas puro. Te damos las herramientas para que la falta de una carta no sea el motivo por el cual te quedes fuera de la mesa. Arma tu mazo, se transparente con tus oponentes y, sobre todo, sigue jugando.
            </p>
          </section>

          {/* Section: Aviso legal */}
          <section className="bg-gray-100 p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-black mb-3 uppercase" style={{ fontFamily: "var(--font-display)" }}>
              Aviso Legal y Reconocimiento Artistico
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              Proxie.cards es un proyecto independiente creado por y para jugadores. No estamos afiliados, respaldados, patrocinados ni asociados de ninguna manera con Wizards of the Coast, Hasbro, ni con ningun otro creador o distribuidor oficial de juegos de cartas coleccionables. Todos los nombres de los juegos, mecanicas, marcas registradas y propiedades intelectuales mencionadas o representadas pertenecen exclusivamente a sus respectivos duenos.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">
              Asimismo, en Proxie.cards sentimos un profundo respeto y admiracion por el trabajo de los ilustradores y disenadores que dan vida a estos universos. Reconocemos que todo el arte original pertenece a sus respectivos artistas y creadores. Nuestros PROXIES son elaborados estrictamente con fines de testeo, accesibilidad y juego casual, buscando mantener viva la pasion por el juego en la mesa, sin intencion de vulnerar los derechos de autor ni de reemplazar el producto oficial.
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0a0b10] py-8 px-6 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <Link 
            href="/deckbuilder" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent-blue text-white text-sm font-bold tracking-widest uppercase hover:bg-accent-blue-dim transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ARMAR MI MAZO
          </Link>
          <p className="text-xs text-white/40 mt-6">
            © {new Date().getFullYear()} Proxie.cards. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
