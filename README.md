# Visdeurbel — Vangstdata 2026
## Procesdocumentatie · Mitchell

> Een scrollende datavisualisatie over **de Visdeurbel**: de camera bij de Weerdsluis in
> Utrecht die afgaat zodra een vis voorbijzwemt en bezoekers wereldwijd op de digitale bel
> drukken. Dit document beschrijft mijn proces over vier weken — van een eerste ruw
> prototype, via een herbouw in React met een echte datapijplijn, naar een afgewerkte,
> toegankelijke en interactieve scrollytelling.

---

## De rode draad

Het project groeide in vier stappen, waarbij elke week voortbouwde op de vorige:

| Week | Thema | Kort |
|---|---|---|
| **1** | Prototype | Een eerste scrollytelling in kale HTML/CSS/JS — de vormen en de datastroom uitvinden. |
| **2** | Herbouw in React | Alles opnieuw in React + Vite, met een Python-datapijplijn die het zware eventbestand (288 MB) vooraf samenvat. |
| **3** | Afwerking & toegankelijkheid | Design tokens, golf-overgangen, ingekleurde vis-foto's, een toegankelijkheidsmenu en een feiten-carousel. |
| **4** | Refactor & verdieping | Elk hoofdstuk z'n eigen grafiek, een Jaar-modus, een meescrollend gids-visje en een radar met tijd-slider. |

Per week beschrijf ik dezelfde drie dingen: **wat ik bouwde**, **waar ik tegenaan liep** en
**wat ik ervan leerde**.

### Gebruikte technologieën

| Technologie | Doel |
|---|---|
| React + Vite | Componenten, routing en dev-server (vanaf week 2) |
| D3.js v7 | SVG-visualisaties (ring, radar, net, talen, kaart) |
| Canvas API | Aquarium-animatie (zwemmende vissen) en de vijver |
| GSAP | Het meescrollende gids-visje (week 4) |
| Embla Carousel | De "Visdeurbel in cijfers"-carousel (week 3) |
| IntersectionObserver | Hoofdstukken pas tekenen bij het scrollen |
| `fetch` + async/await | Asynchroon laden van de verwerkte JSON |
| Python 3 | Het zware eventbestand vooraf aggregeren tot compacte JSON |

---

# Week 1 — Prototype: de eerste scrollytelling

*Eerste week: niet meteen "netjes", maar uitvinden hoe het verhaal eruit kan zien.* Ik
begon bewust klein, in **kale HTML, CSS en JavaScript** (zonder framework), zodat ik me kon
concentreren op twee vragen: hoe krijg ik de ruwe data klein genoeg voor de browser, en hoe
laat ik de visualisaties één voor één verschijnen terwijl je scrollt?

### De datastroom

De ruwe event-log werd met een Python-script (`csv_to_json.py`) verwerkt tot één compacte
`vis-data.json` met alleen de aantallen die de grafieken nodig hadden: tellingen per
vissoort, dagcijfers en uurdata. De pagina laadde die JSON asynchroon vóór het opstarten van
de visualisaties — wat meteen betekende dat de pagina via een **HTTP-server** moest draaien
(`fetch` werkt niet over `file://`):

```bash
python3 -m http.server 7823       # vanuit de projectmap
# → http://localhost:7823/index%20copy.html
```

### De pagina

De prototype-bestanden:

```
vis/ (prototype)
├── index copy.html     # actieve pagina (losse CSS + JS)
├── scripts/main.js     # alle visualisatielogica (~1822 regels)
├── styles/style.css    # alle styling (~1174 regels)
└── json/
    ├── vis-data.json   # verwerkte data
    └── csv_to_json.py  # verwerkingsscript: eventlog → vis-data.json
```

De stijl draaide om een handvol CSS Custom Properties (water-blauw, goud-accent, een serif +
mono lettertype) en een `.reveal`-techniek: elementen starten onzichtbaar
(`opacity: 0; translateY(28px)`) en verschijnen zodra hun hoofdstuk in beeld komt.

### Hoofdstuk-architectuur

De kern die ik hier bedacht, is in alle latere weken blijven bestaan. Elk hoofdstuk
registreert een teken-functie onder zijn `id`, en een `IntersectionObserver` roept die
**één keer** aan zodra de sectie in beeld komt:

```js
chapterInit['ch-aquarium'] = (el) => { /* … */ };

// observer tekent elk hoofdstuk pas bij scrollen, en maar één keer
sectionObserver  // zet data-inited="1" na de eerste keer
```

Een paar hulpfuncties die ik later overal hergebruikte: `mulberry32(seed)` (een
reproduceerbare random-generator), `generateMonthly(total)` (verdeelt een totaal over de
maanden volgens een seizoenscurve), `fmt(n)` (Nederlandse duizendtal-notatie) en een
gedeelde tooltip.

### De eerste hoofdstukken: wanneer gaat de bel?

De vormen die ik als eerste prototypeerde draaiden allemaal om **tijd** — wanneer de bel het
vaakst gaat. Ze legden de basis (polaire coördinaten, area-charts) waar de latere weken op
voortbouwden.

> De afbeeldingen hieronder komen uit de **gearchiveerde (legacy) versie** van deze
> hoofdstukken — de React-uitwerking die in week 4 naar een `legacy/`-map verhuisde (zie
> [Week 4](#week-4--refactor-jaar-modus--afwerking)). De vormen zelf ontstonden hier in week
> 1. Voor dit document heb ik die gearchiveerde hoofdstukken even opnieuw laten draaien om er
> screenshots van te maken.

**De binnenkomst.** Een wolk van deeltjes vormt langzaam een vis én het totaal aantal
bel-oproepen — de opening van het verhaal.

<img alt="image" src="https://github.com/user-attachments/assets/ae2889c1-071c-4cc1-a0e8-7cb1cd5bbff5" />

**Ringkalender.** Het eerste hoofdstuk dat "af" voelde: een **polaire heatmap** waarin elke
stip één uur is, op een ring rond het maandtotaal. Hoek per stip `(i / SLOTS) × 2π − π/2`;
helderheid = aantal beldrukken dat uur. Dit dwong me na te denken over polaire coördinaten —
kennis die later bij het getij en de radar goed van pas kwam.

<img alt="image" src="https://github.com/user-attachments/assets/e08728c1-aaa5-43ca-a668-f6915bc225fc" />

**24-uurs getij.** Een ronde wijzerplaat waarvan het "waterpeil" stijgt en daalt: hoogtij
rond 18u (als Nederland thuiskomt), het stilst rond 03u. Getekend met `d3.lineRadial`.

<img src="https://github.com/user-attachments/assets/0468116a-eee4-4258-bb3c-78fc67335e4d" />


**Weekend vs doordeweeks.** Twee 24-uurs curves over elkaar — doordeweeks vs weekend,
gemiddeld per dag — om te zien of het weekend op een ander ritme belt.

<img alt="image" src="https://github.com/user-attachments/assets/0f040e1f-4156-4f65-ab4b-0cb70e3fc005" />

**Piekdagen-rivier.** Een area-chart over de maand met de drukste dag geannoteerd (17 mei,
7.878 belletjes) — niet elke dag is gelijk.

<img alt="image" src="https://github.com/user-attachments/assets/85d5f0bd-e97a-4488-b3f8-eeecba010f28" />

### Struggles & oplossingen

| Struggle | Oplossing |
|---|---|
| `fetch` werkte niet door dubbelklikken op het HTML-bestand | De pagina via `python3 -m http.server` serveren |
| Bij een mislukte data-load was de pagina leeg | Alle tellers op `0` laten starten + een fallback die data genereert, zodat het altijd iets toont |
| Eén `main.js` van ~1822 regels werd onoverzichtelijk | Reden om het in week 2 helemaal opnieuw, modulair, op te zetten |

### Wat ik leerde

- **Scheid dataverwerking van visualisatie.** Zware aggregatie hoort in een aparte stap
  (Python), niet in de browser.
- **`IntersectionObserver` is ideaal voor scrollytelling**: je tekent alleen wat in beeld
  komt, dus de pagina blijft licht.
- **Eén groot JS-bestand schaalt niet.** Het prototype werkte, maar werd onhoudbaar — de
  aanleiding om in week 2 over te stappen op React met losse modules.

*Bijgewerkt: 21 mei 2026*

---

# Week 2 — Opnieuw opgebouwd in React + de echte datapijplijn

*Met de vormen uit week 1 op zak, bouwde ik alles opnieuw op — dit keer schaalbaar.* De
pagina werd een React-component, de logica ging in losse modules, en ik pakte het échte,
veel grotere databestand aan.

### Waarom een aparte datapijplijn

De ruwe data is **NDJSON** (één JSON-object per regel) met events als `uploadedFish` ("de
bel ging") en `dismissedUploading` ("weggeklikt"), plus velden als `country`, `browser`,
`device`, `language`, `screen` en `created_at`. Het maandbestand is **288 MB** — onmogelijk
om in de browser te parsen. Daarom splitste ik de pijplijn:

```
event-maand.json (288 MB)  ─┐
                            ├─►  build_visdata.py  ─►  vis-data.json      (~40 KB)
event-week.json   (44 MB)  ─┘        (Python)         vis-data-week.json (~36 KB)
                                                              │
                                            fetch('/json/…') │
                                                              ▼
        Mitchell.jsx  ──(rendert secties + roept)──►  mitchell.js  ──(D3/Canvas)──►  SVG/Canvas
        (React-markup)                                 (initMitchell)
```

### `build_visdata.py` — streaming aggregatie

Eén pass leest het bestand **regel voor regel** (nooit alles in het geheugen) en telt alles
wat de hoofdstukken nodig hebben. Hetzelfde script maakt zowel de maand- als de weekdata:

```python
for line in f:                                   # regel voor regel = lage geheugendruk
    d = json.loads(line)
    if d.get("hostname") != "visdeurbel.nl":     # ruis van andere hosts eruit
        continue
    country[d.get("country", "")] += 1
    ev[d.get("event_name", "")] += 1             # uploadedFish vs dismissedUploading
    lang[(d.get("language") or "").split("-")[0]] += 1   # 'en-US' -> 'en'
    if d.get("event_name") == "uploadedFish":
        dt = datetime.strptime(d["created_at"], "%Y-%m-%d %H:%M:%S")
        pond[dt.weekday()*1440 + dt.hour*60 + dt.minute] += 1   # minuut-van-de-week
```

De output bevat o.a. `geo` (landen), `funnel` (wel/niet bellen), `tech` (device/browser/os),
`sessions`, `languages`, `pondWeek` (10.080 minuten) en de tijdreeksen `weekHours`/`daily`.
**40 KB laadt instant**; de grafieken hebben toch alleen de getallen nodig, niet de losse
events.

### De scrollytelling-motor

Dezelfde aanpak als in week 1, nu netjes als module. Een `IntersectionObserver` voegt een
`visible`-klasse toe (voor de reveal-animatie) en tekent elk hoofdstuk één keer:

```js
const chapterInit = {};                          // { 'ch-ring': fn, 'ch-world': fn, … }

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    if (!entry.target.dataset.inited) {          // maar één keer tekenen
      entry.target.dataset.inited = '1';
      chapterInit[entry.target.id]?.(entry.target);
    }
  });
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
```

Gedeelde helpers: `showTooltip()`/`hideTooltip()`, een `reduceMotion`-check
(`prefers-reduced-motion`) en een `rafs`-set + `cleanups`-array om alle animatieframes en
observers netjes te kunnen stoppen.

### De dertien hoofdstukken

In de React-versie groeide het naar een reeks hoofdstukken die elk een andere kant van de
data lieten zien. De tijd-hoofdstukken uit week 1 (ring, getij, weekend/doordeweeks, pieken)
kwamen mee; daar bovenop kwam een tweede laag over **wie** er belt, **waarvandaan** en
**waarmee**. Een greep eruit — opnieuw met afbeeldingen uit de later gearchiveerde versie:

**Wereldkaart.** Elk land licht op en bogen stromen naar Utrecht. Om de fragiele join met de
TopoJSON-ID's te vermijden, plaats ik de stippen via een eigen centroïdtabel en teken ik het
land alleen als achtergrond. Met een **Wereld ↔ Europa**-toggle.

<img alt="image" src="https://github.com/user-attachments/assets/95ee2232-2f4a-4cdc-825f-2c39b46eaa92" />

**Draaiende globe.** Een orthografische bol die meedraait met een "wereldklok": elk land
licht op wanneer het daar lokaal avond wordt, zodat de avondpiek de planeet rondreist.

<img alt="image" src="https://github.com/user-attachments/assets/fb67bb10-a031-497d-9364-8ae0d3d454db" />

**Belstroom (funnel).** Twee linten laten zien dat ~19% écht aanbelt en ~81% wegklikt;
deeltjes stromen langs de paden en de bel "rinkelt" bij aankomst.

<img alt="image" src="https://github.com/user-attachments/assets/34d78c31-ec76-48be-95f1-02d3918a7435" />

**De fanatici.** Een histogram van bel-oproepen per bezoek (√-schaal voor de lange staart):
de recordhouder belde **157×**, en de drukste **1%** is samen goed voor **~20%** van álles.

<img alt="image" src="https://github.com/user-attachments/assets/f881dd2b-c640-4f00-b191-ac58177fc9a9" />

**Een school van apparaten.** Samenscholende bubbels per browser, gekleurd per familie
(Chrome-achtig, Safari/iOS, Firefox, social in-app). ~59% kijkt mee vanaf de telefoon.

<img alt="image" src="https://github.com/user-attachments/assets/2314ee51-6d74-4e28-8a35-d2169936bd4a" />

**Schermen-aquarium.** Elke schermresolutie als doorschijnend venster op zijn échte
beeldverhouding; staand vs liggend. ~66% kijkt staand (telefoon).

<img alt="image" src="https://github.com/user-attachments/assets/0282df9d-00cc-4be4-8600-48a5ba8a5575" />

**Dieptelagen.** Elke soort op zijn eigen diepte — oppervlak, midden of bodem — die oplicht
als je eroverheen beweegt. Gebruikt de `<symbol>`-vissprite.

<img alt="image" src="https://github.com/user-attachments/assets/13f7588e-413e-4fdc-966f-a65d330beb21" />


Plus het **koor van talen**, de **radar**, het **net** en de **vijver**, die in week 3 en 4
verder zijn uitgewerkt of vervangen.

### De Maand/Week-schakelaar

Een sticky pill wisselt de dataset. Omdat hoofdstukken maar één keer tekenen, moest ik ze
kunnen **opruimen en opnieuw laten tekenen**:

<img alt="image" src="https://github.com/user-attachments/assets/1cec6464-6691-461d-8408-f5352535ec45" />

```js
async function setPeriod(period) {
  if (period === currentPeriod) return;
  currentPeriod = period;
  clearChapters();                                  // stop animaties + leeg de stages
  await loadData(period === 'week' ? '/json/vis-data-week.json' : '/json/vis-data.json');
  observeChapters();                                // her-observeren → observer vuurt opnieuw
}
```

De truc: opnieuw `observe()`n stuurt meteen een nieuwe melding voor elk zichtbaar hoofdstuk,
dat zich dan hertekent met de nieuwe data. Alle hoofdstukken passen zich automatisch aan
(7/9 vs 31 dagen) omdat ze de **lengte van de data-arrays** lezen.

### Struggles & oplossingen

| Struggle | Wat er misging | Oplossing |
|---|---|---|
| **288 MB in de browser** | Het maandbestand in JS parsen is onmogelijk | Vooraf aggregeren met Python tot ~40 KB |
| **`npm run dev` startte niet** | `node_modules` was van een Windows-machine gekopieerd → ontbrekende macOS-binaries | `rm -rf node_modules package-lock.json && npm install` per machine |
| **Getij stond in de hoek** | `d3.lineRadial` tekent rond oorsprong (0,0) | Het pad in een `<g transform="translate(cx,cy)">` centreren |
| **Wereldkaart-join** | Mijn landcodes (`US`) matchen niet met de numerieke ISO-id's van de TopoJSON | Eigen centroïdtabel; het land alleen als achtergrond tekenen |
| **Dataset wisselen** | Hoofdstukken tekenden dubbel + animaties bleven lopen | `clearChapters()` + her-observeren |

### Wat ik leerde

- **`node_modules` is platform-specifiek** — je kopieert het niet tussen Windows en Mac,
  je draait `npm install` per machine.
- **D3 radiale generators tekenen rond (0,0).** Centreren doe je zelf met een `transform`.
- **Vermijd fragiele joins.** Een eigen tabel aanhouden gaf minder afhankelijkheden en bugs.
- **Animaties hebben een levenscyclus.** Wat je start (`requestAnimationFrame`, observers,
  simulaties) moet je ook kunnen stoppen — anders lekt het bij hertekenen.
- **Laat de visualisatie de data volgen, niet andersom.** Door overal arraylengtes te lezen
  werkt dezelfde code voor week- én maanddata.

*Bijgewerkt: 26 mei 2026*

---

# Week 3 — Visuele afwerking & toegankelijkheid

*De data werkte; nu moest het er ook uitzien als één geheel — en bruikbaar zijn voor
iedereen.* Deze week ging over **uitstraling**, **interactiviteit** en **toegankelijkheid**.

### Design tokens & sectie-thema

`mitchell.css` legt alle kleuren, lettertypes en spacing vast als CSS Custom Properties; een
tweede stylesheet wisselt de achtergrond per sectie (donker groen ↔ crème) voor ritme. Het
palet volgt de huisstijl met **Bricolage Grotesque** + **PT Sans**, zonder puur zwart/wit.

```css
:root {
  --color-green: #01463c;   --color-teal: #1eacb0;
  --color-off-white: #fdf7ef;
  --font-display: 'Bricolage Grotesque', sans-serif;
  --font-body: 'PT Sans', sans-serif;
  --easing: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Golvjes (`SectionWave`)

Tussen secties zit een decoratieve **golf-overgang** die twee kleuren met elkaar verbindt,
net als op visdeurbel.nl. Het is één periodieke golf-`path` (breder dan het beeld) met een
subtiele horizontale drift-animatie, zodat hij naadloos doorloopt — de sectie-kleur is de
achtergrond, de golf-`fill` is de kleur van de sectie eronder.

### Vissen als PNG + inkleuren

Elke vissoort kreeg een eigen **PNG-foto**. Die foto's zijn grijs/neutraal en worden
**luminantie-behoudend** ingekleurd met de soort-kleur: eerst grijswaarde
(`Y = 0.299R + 0.587G + 0.114B`), dan die intensiteit vermenigvuldigen met de doelkleur. Zo
houdt elke vis zijn textuur maar krijgt hij toch zijn kleur — bruikbaar in het aquarium, de
radar en het net.

### Toegankelijkheidsmenu

Een vast ♿-menu (links) met twee schakelaars: **Animaties uit** en **Hoger contrast**. De
keuze wordt onthouden in `localStorage`, gespiegeld naar `window.__reduceMotion` en naar een
klasse op `<body>`:

```jsx
useEffect(() => {
  window.__reduceMotion = reduceMotion;
  document.body.classList.toggle('a11y-reduce-motion', reduceMotion);
  localStorage.setItem('a11y-reduce-motion', reduceMotion);
}, [reduceMotion]);
```

### De Visdeurbel in cijfers

Een feiten-carousel (Embla) leest de data en zet die om in losse kaartjes met grote koppen,
paarse highlights en een korte toelichting per feit (de `?`-knop).

<img alt="image" src="https://github.com/user-attachments/assets/8c229990-8dca-4810-ac48-976e9d072394" />

### Wereldkaart + Europa-toggle

De kaart kreeg een **Wereld ↔ Europa**-schakelaar (Natural Earth vs. Mercator). De landen
worden als achtergrond getekend en de data-stippen via een eigen centroïdtabel geplaatst, met
de top-5 landen tab-baar.

### Kijkglas (aquarium)

Een Canvas-aquarium waarin een steekproef van ~80 vissen rondzwemt, proportioneel verdeeld
per soort, met filter-chips om soorten aan/uit te zetten en een klik-om-te-schrikken-effect.

<img alt="image" src="https://github.com/user-attachments/assets/865790d7-e759-4073-9c95-5cd65a7010a8" />

### Het net (bubble-pack)

Een `d3.pack`-bubbeldiagram met een toggle tussen **Aantal**, **Biomassa** en **Gewicht per
vis** — zo zie je dat een paar zware meervallen opwegen tegen een hele school blankvoorns.

### Struggles & oplossingen

| Struggle | Wat er misging | Oplossing |
|---|---|---|
| **Europa werd één blob** | Grote, dicht op elkaar liggende stippen + botsende labels | Kleinere stippen + een "top-5 bellers"-bijschrift |
| **Radar-vissen onzichtbaar** | `<use href="#fish-…">` verwees naar symbolen die niet in de DOM stonden | Een verborgen SVG-sprite met `<symbol>`-vissen toegevoegd |
| **Kleur platte de foto's** | Recht overschrijven verloor de textuur | Luminantie-behoudend tinten (grijswaarde × kleur) |

### Wat ik leerde

- **Een styleguide volgen versnelt juist.** Vaste tokens en lettertypes betekenen minder
  twijfel en een consistente look over heel verschillende hoofdstukken.
- **Toegankelijkheid hoort vroeg.** `prefers-reduced-motion` respecteren en contrast bieden
  is makkelijker als je het meeneemt tijdens het bouwen dan achteraf.
- **Echte assets geven karakter.** Ingekleurde vis-foto's maken het geheel persoonlijker dan
  abstracte vormen.

*Bijgewerkt: 3 juni 2026*

---

# Week 4 — Refactor, Jaar-modus & afwerking

*De laatste week ging niet over méér hoofdstukken, maar over structuur en afwerking:* elk
hoofdstuk z'n eigen grafiek laten bezitten, een derde dataset (Jaar) toevoegen, een
meescrollend gids-visje, een radar met tijd-slider, en overal toegankelijkheid + nette
opruiming.

### Architectuur-refactor: elk hoofdstuk bezit zijn grafiek

In week 3 stond alle grafiek-code los van de markup. Nu **exporteert elke component zijn
eigen `init`-functie** naast zijn JSX, zodat markup en tekenlogica in één bestand zitten:

```js
// Aquarium.jsx
export function initAquarium() { /* canvas-flocking … */ }
export default function Aquarium() { return ( <section id="ch-aquarium" …/> ); }
```

`mitchell.js` is afgeslankt tot een **orchestrator**: hij laadt data, koppelt section-id's
aan init-functies en regelt de levenscyclus. Alles wat niet meeging is niet verwijderd maar
**gearchiveerd** in `legacy/`-mappen, zodat de actieve code schoon blijft maar niets verloren
gaat. Die gearchiveerde hoofdstukken (terug te zien in [Week 1](#week-1--prototype-de-eerste-scrollytelling)
en [Week 2](#week-2--opnieuw-opgebouwd-in-react--de-echte-datapijplijn)) blijven gewoon te
draaien — voor de screenshots in dit document heb ik ze tijdelijk opnieuw gemount.

### Week / Maand / Jaar

De schakelaar kreeg er een derde knop bij: **Jaar**.

De échte jaardata is te groot voor de browser, dus de jaar-stand **verzint** een
geloofwaardig jaar uit de maand-snapshot (`synthesizeYear`): alle tellers ×12, 365 dagen aan
uren met een **seizoensgolf** (piek in het voorjaar) plus ruis, en een opnieuw opgebouwde
kalender:

```js
const season = 0.65 + 0.55 * Math.sin(((d - 80) / DAYS) * Math.PI * 2);
const jitter = 0.82 + Math.random() * 0.36;
yearHours[d * 24 + h] = Math.round(base * season * jitter);
```

Omdat alle hoofdstukken de **arraylengte** lezen (7 / 31 / 365 dagen), schakelen ze
automatisch mee.

### Het meescrollende gids-visje (`swimFish.js`)

Een klein **baars-visje** zwemt met je mee en cirkelt steeds om de grafiek die het dichtst
bij het midden van het scherm staat. Het is puur decoratief (`aria-hidden`) en wordt
overgeslagen bij `prefers-reduced-motion`.

<img alt="image" src="https://github.com/user-attachments/assets/66f79642-a6ae-4188-8140-e9426cbaa988" />

Elke frame kiest het een doel — een punt op een ellips rond de actieve grafiek, met de hoek
afgeleid uit de scroll-voortgang — en glijdt daar soepel naartoe (lerp, met GSAP):

```js
const angle = scrollProgress * Math.PI * 2.6 + elapsed * 0.35;
return { x: centerX + Math.cos(angle) * radiusX, y: centerY + Math.sin(angle) * radiusY,
         tx: -Math.sin(angle) * radiusX, ty: Math.cos(angle) * radiusY };  // richting → kanteling & flip
```

### Vissen inkleuren — nu op twee manieren

De luminantie-tint uit week 3 kreeg een tweede route, afhankelijk van de techniek:

- **Canvas — per pixel** (`buildSprite` in het aquarium): de foto op een offscreen canvas
  tekenen en elke pixel herschrijven. Eén sprite per soort+kleur wordt gecachet, op HiDPI
  geschaald.
- **SVG — filter** (`ensureTintFilter`): een `<feColorMatrix>` (grijswaarde) + een
  `<feComponentTransfer>` (naar de doelkleur), idempotent per kleur. Gebruikt door radar en
  net, waar de vissen `<image>`-elementen zijn.

Beide delen dezelfde constanten (`L = 0.4` richting wit, `lift = 1.12`).

### Radar met tijd-scrubber (`RadarChapter`)

De sonar uit week 2 werd een volwaardig hoofdstuk. Elke vissoort is een "ping"; de afstand
tot het midden volgt uit het aantal waarnemingen via een **wortelschaal** (zodat kleine
soorten zichtbaar blijven). De plaatsing vermijdt overlap (best-of-N: tot 60 hoeken
proberen), en de gloed van een ping flitst synchroon met de CSS-sweep via een negatieve
`animation-delay`.

<img alt="image" src="https://github.com/user-attachments/assets/7bdb5d43-c780-464f-9098-9a041a021f56" />

Het grote nieuwe stuk is de **tijd-slider**: die groepeert de dagen per dag/week/maand en
verdeelt elk soort-totaal proportioneel over de periodes, met de **"grootste rest"-methode**
zodat de afgeronde waarden exact optellen tot het totaal.

### Het net: echte vissen in de bellen (`NetChapter`)

In week 3 waren de bellen gekleurde cirkels; nu zit in elke bel de **echte vis-foto** (met
het tint-filter), met een glans-hooglicht voor een bol-illusie. De toggle blijft
Aantal / Biomassa / Gewicht.

<img alt="image" src="https://github.com/user-attachments/assets/b3316758-322a-439c-b580-cabd195e815b" />

Twee dingen netjes opgelost: `d3.pack` centreert zijn *omhullende* cirkel (niet de bellen),
dus ik bereken de echte bounding-box en schaal + centreer de hele laag daarop. En nieuwe
bellen **vallen** er met een staggered delay één voor één in.

### Het koor van talen (`LanguagesChapter`)

Elk woord is nu het woord **"vis" in de werkelijke taal** van de bezoeker (Fish, Fisch,
Ryba, Vis, 鱼 …), zo groot als het aantal bezoekers. Een force-simulatie trekt de woorden
naar het midden en duwt ze uit elkaar; bij `prefers-reduced-motion` wordt de layout in 220
stille ticks doorgerekend en in één keer neergezet.

<img alt="image" src="https://github.com/user-attachments/assets/81720e35-981b-437d-b741-eb90509afd43" />

> Dit verving een eerdere week-3-aanpak waarin de talen als vaste vis-námen (Blankvoorn,
> Baars…) werden getoond — het woord *vis* in de echte taal is betekenisvoller én
> themaversterkend.

### Aquarium-afwerking

Het kijkglas werd op detail bijgewerkt: **HiDPI-scherpe** sprites (geschaald op
`devicePixelRatio`), een `ResizeObserver`, een hover-tooltip met de **lengte in cm**, grootte
op de **derdemachtswortel** van het gewicht (zware soorten domineren niet), een verticale
flip wanneer een vis naar links zwemt, en een pauze (via `IntersectionObserver`) zodra het
aquarium buiten beeld is.

### Toegankelijkheid & robuustheid

Bovenop het ♿-menu: een **skip-link**, een `sr-only`-introtekst voor schermlezers, en per
grafiek een tekstuele **samenvatting** (`aria-live`) die met de dataset meeverandert.
`reduceMotion()` wordt nu in **elk** hoofdstuk gerespecteerd.

Voor de levenscyclus is `lifecycle` (in `state.js`) de centrale plek: elke chart pusht zijn
cleanup en registreert zijn frames. `clearChapters()` ruimt alles op vóór een hertekening, en
omdat React in StrictMode dubbel mount/unmount, vangt een **`disposed`-vlag** dat op:

```js
async function boot() {
  await loadData('/json/vis-data.json');
  state.worldTopo = await fetch('/json/world-110m.json').then(r => r.json());
  if (disposed) return;            // cleanup liep al → niets meer opzetten
  observeChapters();
  swimTeardown = initSwimFish();
}
```

### Struggles & oplossingen

| Struggle | Wat er misging | Oplossing |
|---|---|---|
| **Twee plekken per hoofdstuk** | Markup en grafiek liepen uit de pas | Init-functie ín de component zetten; orchestrator koppelt alleen id → init |
| **Jaardata te groot** | Een echt jaar inladen is onmogelijk | `synthesizeYear()`: maand ×12 + seizoensgolf + ruis |
| **Net-tros stond scheef** | `d3.pack` centreert de omhullende cirkel, niet de bellen | Eigen bounding-box berekenen en daarop schalen + centreren |
| **Radar-afronding klopte niet** | Proportioneel verdelen telde net niet op | "Grootste rest"-methode |
| **Gids-visje bleef achter** | Bij navigeren/StrictMode hing het op andere routes | Teardown + `disposed`-vlag |

### Wat ik leerde

- **Code die samen verandert, hoort bij elkaar.** De grafiek ín zijn component zetten
  scheelt fouten doordat markup en logica niet meer uit de pas lopen.
- **Archiveer, gooi niet weg.** Een `legacy/`-map houdt het project schoon zonder werk kwijt
  te raken.
- **Verzonnen data mag, mits eerlijk opgebouwd.** Een seizoensgolf + ruis maakt het jaar
  geloofwaardig; de "grootste rest"-correctie houdt de totalen kloppend.
- **Eén formule, twee technieken.** Dezelfde luminantie-tint werkt zowel per pixel op canvas
  als via een SVG-filter — de keuze hangt af van het hoofdstuk.
- **Wat je start, moet je kunnen stoppen** — zeker met React StrictMode, dat alles dubbel
  doet.

*Bijgewerkt: 18 juni 2026*

---

# Bestandsstructuur (eindstand)

```
src/
├── pages/
│   └── Home.jsx                     # actieve pagina: Carousel→Aquarium→Radar→Talen→Net
│
├── components/mitchell-components/
│   ├── Aquarium.jsx                 # JSX + initAquarium (canvas-flocking)
│   ├── RadarChapter.jsx             # JSX + initRadar (sonar + tijd-scrubber)
│   ├── NetChapter.jsx               # JSX + initNet (bubble-pack met vis-foto's)
│   ├── LanguagesChapter.jsx         # JSX + initLanguages ("vis" per taal)
│   ├── DataCarousel.jsx             # "Visdeurbel in cijfers" (Embla)
│   ├── DataSwitch.jsx               # Week / Maand / Jaar
│   ├── SectionWave.jsx              # periodieke golf-overgang
│   ├── FishSprite.jsx               # verborgen <symbol>-visvormen
│   └── legacy/                      # gearchiveerde hoofdstukken (hero, ring, wereldkaart …)
│
├── scripts/
│   ├── mitchell.js                  # orchestrator: data, observer, levenscyclus
│   └── mitchell/
│       ├── state.js                 # gedeelde state + lifecycle (cleanups/rafs)
│       ├── dataLoad.js              # loadData() + synthesizeYear()
│       ├── constants.js             # COLORS, vissoorten (+lengte), GREETINGS, geo
│       ├── utils.js                 # $, formatNumber, reduceMotion, mulberry32
│       ├── tooltip.js               # één gedeelde tooltip
│       ├── fishImage.js             # ensureTintFilter (SVG) + hexToRgb01
│       ├── swimFish.js              # het meescrollende gids-visje (GSAP)
│       └── charts/legacy/           # gearchiveerde teken-scripts + legacy-support.js
│
└── (styles geserveerd uit public/styles/: mitchell.css, mitchell-week1.css,
     mitchell-carousel.css, mitchell-sections.css, a11y-menu.css)
```

# Opstarten (lokaal)

```bash
npm install        # eenmalig (node_modules is platform-specifiek)
npm run dev        # Vite dev-server → http://localhost:5173/
```

Data opnieuw genereren als een eventbestand is bijgewerkt:

```bash
python3 json/build_visdata.py json/event-maand.json vis-data.json
python3 json/build_visdata.py json/event-week.json  vis-data-week.json
```

---

# Reflectie

Van een ruw prototype in week 1 naar een afgewerkte, toegankelijke scrollytelling in week 4
is de rode draad telkens dezelfde gebleken: **laat de data het werk sturen, en ruim code
langzaam op.** De Python-pijplijn doet het zware werk vooraf, de hoofdstukken lezen alleen de
getallen en passen zich aan elke periode aan, en alles wat ik start kan ik ook weer stoppen.
De grootste sprong zat niet in een nieuw hoofdstuk, maar in het goed begrijpen van de code van iedereen en de **structuur**: door elk
hoofdstuk zijn eigen grafiek te laten bezitten en oude code te archiveren, werd het project
voor het meer onderhoudbaar en bleef er ruimte over voor de leuke details, zoals het
visje dat met je meezwemt. Verder voor de volgende keer meenemen. Het was slim om AI toe te passen om snel iteraties te maken, maar voor de volgende keer is het ook belangrijk om goed bij te houden wat er gebeurd. Dit had ik nu te laat gedaan, waardoor ik later meer tijd moest stoppen om weer terug te schakelen naar wat er gebeurde en hoe het werkte. Kijkend naar mijn leerdoelen ben ik tevreden over de verbetering. Mijn eerste leerdoel was samenwerking ik vind dat mijn samenwerking vaardigheden erg zijn verbeterd met online communicatie tot dagelijkse stand-up. Verder ook met git, zoals de merge conflicts en pr ben ik tevreden van het proces, maar echter merk ik wel dat de eindproduct wel nog steeds ondanks de SPA nog duidelijk 4 verschillende secties zijn. Ik probeerde doormiddel van waves nog een consistente doorloop van de pagina te maken, maar de ontwerp stylen liggen nog steeds best uit elkaar en is makkelijk te onderscheiden. Maar nog steeds verbetering van alles op eigen initiatief doen en niet meer goed omkijken naar andere heb ik dat dit project aanzienlijk verbeterd. Volgende was UX, ik had vaak dat het soms onduidelijk is wat er verwacht wordt van de gebruiker, maar door de feedback sessies met de opdrachtgever is het nu onder de testpersonen en de opdrachtgever duidelijk wat er verwacht wordt. De laatste was datavisualisatie, hier had ik nog nooit eerder mee gewerkt het was dus best een uitdaging, maar na veel tutorials en voorbeelden van D3 library. Is het toch redelijk goed gelukt en begrijp ik het een stuk beter dan ik daarvoor deed.
