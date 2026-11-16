import { Link } from "react-router"
import { PluginPreview } from "../components/PluginPreview"
import { SiteChrome } from "../components/SiteChrome"

const ORGANIZATION = "https://github.com/placard-app"

const plugins = [
  {
    id: "places.day-out",
    name: "Day Out",
    tagline: "One favourite place. A whole day of possibilities.",
    description:
      "Build a day around a saved place. Find a café before the museum or dinner nearby, arrange your stops and keep the outing ready for next time.",
    image: "day-out.svg",
    screenshot: "day-out-desktop.png",
    alt: "Day Out route connecting a coffee stop, a favourite place and dinner nearby",
    features: [
      "Nearby stops from your library",
      "Editable, private itineraries",
      "Navigation links & MCP planning",
    ],
  },
  {
    id: "places.board",
    name: "Board",
    tagline: "Your favorite places. A board of your own.",
    description:
      "Turn 22 saved places into a travel board. Arrange your stops, customize the labels, explore a 3D preview and export a print-ready PDF for a print shop or your home printer.",
    screenshot: "board-desktop.png",
    image: "board.svg",
    alt: "Illustration of a travel board with colored place tiles around its edge",
    features: ["22 places from your library", "Flat & 3D previews", "Print-ready PDF exports"],
  },
  {
    id: "places.menus",
    name: "Menus",
    tagline: "The menu, saved with the place.",
    description:
      "Keep lunch, dinner and drinks menus on your restaurant, café and bar cards. Organize sections and dishes, add prices, variants and item photos, and edit them manually or with an MCP assistant.",
    screenshot: "menus-desktop.png",
    image: "menus.svg",
    alt: "Illustration of a restaurant menu with sections, dishes and prices",
    features: ["Menus on place details", "Prices, variants & photos", "MCP editing"],
  },
  {
    id: "places.pick",
    name: "Pick",
    tagline: "Let your library choose tonight.",
    description:
      "Choose a random place from your collection. Narrow the pool by category, list, tag, opening hours or distance, and avoid recent picks when you want somewhere different. Save your preferred settings for next time.",
    screenshot: "pick-desktop.png",
    image: "pick.svg",
    alt: "Placard Pick plugin cover illustration",
    features: ["A dedicated Pick page", "Library & distance filters", "Avoid recent picks"],
  },
  {
    id: "places.decide-together",
    name: "Decide Together",
    tagline: "Vote on where to go.",
    description: "Vote on a shortlist and reveal your household’s favorite places.",
    image: "decide-together.svg",
    screenshot: "decide-together-desktop.png",
    alt: "Illustration of a shared shortlist with a checkmark on a favorite place",
    features: ["Shared shortlists", "Household voting", "Reveal your favorites"],
  },
  {
    id: "places.visit-journal",
    name: "Visit Journal",
    tagline: "What was it like last time?",
    description:
      "Keep a dated note on a place after each visit. When you return, your notes are right there on its place card.",
    image: "visit-journal.svg",
    screenshot: "visit-journal-desktop.png",
    alt: "Open notebook with a place pin and a ribbon bookmark",
    features: ["Private visit history", "Dated notes", "On each place card"],
  },
  {
    id: "places.want-to-try",
    name: "Want to Try",
    tagline: "For the next time you’re here.",
    description:
      "Keep a private checklist on each place card. Save a dish, a table or something else to try, then tick it off when you do.",
    image: "want-to-try.svg",
    screenshot: "want-to-try-desktop.png",
    alt: "Clipboard with one item checked off",
    features: ["Per-place checklists", "Private to your account", "Check off or reopen items"],
  },
  {
    id: "places.walk-bingo",
    name: "Walk Bingo",
    tagline: "How much can you spot on a walk?",
    description:
      "Deal a card before you head out. Mark the details you spot along the way, from a red door to a bird on a wire. Three in a row makes bingo.",
    image: "walk-bingo.svg",
    screenshot: "walk-bingo-desktop.png",
    alt: "Nine-square bingo card with three green checks on a diagonal",
    features: ["Random spotting cards", "Eight possible lines", "Resume in the same tab"],
  },
  {
    id: "places.secret-landmark",
    name: "Secret Landmark",
    tagline: "One traveler missed the destination.",
    description:
      "Pass one phone around the table. Everyone but the traveler gets the same landmark. Trade clues aloud, then vote on who was bluffing.",
    image: "secret-landmark.svg",
    screenshot: "secret-landmark-desktop.png",
    alt: "Two playing cards with a traveler’s mask and the Eiffel Tower",
    features: ["3–8 players", "Private role cards", "Group vote and reveal"],
  },
]

export function PluginsPage() {
  return (
    <SiteChrome>
      <main id="main" className="plugins-page">
        <header className="plugins-intro">
          <p className="eyebrow">Make room for a little more</p>
          <h1>Your library. A few extra possibilities.</h1>
          <p className="lede">
            Optional plugins for the places you keep. Add the tools you need to your own Placard
            instance to plan outings, remember visits or play a game together.
          </p>
          <a href={`${ORGANIZATION}?q=module-&tab=repositories`} target="_blank" rel="noreferrer">
            Browse the module repositories on GitHub →
          </a>
        </header>

        <section className="plugins-grid" aria-label="Placard plugins">
          {plugins.map((plugin) => (
            <article className="plugin-card" key={plugin.id}>
              <img
                className="plugin-cover"
                src={`${import.meta.env.BASE_URL}plugins/${plugin.image}`}
                alt={plugin.alt}
                width={640}
                height={360}
              />
              <div className="plugin-content">
                <p className="eyebrow">{plugin.id}</p>
                <h2>{plugin.name}</h2>
                <p className="plugin-tagline">{plugin.tagline}</p>
                <p>{plugin.description}</p>
                <ul className="plugin-features">
                  {plugin.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <PluginPreview name={plugin.name} image={plugin.screenshot} />
                <div className="plugin-install">
                  <a
                    href={`${ORGANIZATION}/module-${plugin.id.slice("places.".length)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {plugin.name} guide &amp; source on GitHub →
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="plugin-instructions" aria-labelledby="plugin-install-heading">
          <div>
            <p className="eyebrow">On your instance</p>
            <h2 id="plugin-install-heading">Add a plugin to Placard.</h2>
            <p>
              Already running Placard? An instance administrator can install plugins from Settings.
              New here? <Link to="/docs/install">Install Placard first.</Link>
            </p>
          </div>
          <div>
            <ol>
              <li>Open Marketplace in Placard’s main navigation.</li>
              <li>
                Ask an instance admin to activate a listed plugin or install it using its GitHub
                repository URL.
              </li>
              <li>Open its page or find the feature on your place cards.</li>
            </ol>
            <p>
              Plugins run with full access to your instance. Install code you trust and back up your
              database, media and module data before installing or updating.
            </p>
          </div>
        </section>
      </main>
    </SiteChrome>
  )
}
