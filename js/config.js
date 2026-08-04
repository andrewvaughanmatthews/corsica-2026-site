// Edit this file to customise the site without touching any other code.

const CONFIG = {
  TRIP_START: "2026-08-08T07:00:00+01:00", // UK time, matches home pickup
  TRIP_END: "2026-08-22T18:19:00+01:00",   // UK time, matches home drop-off

  // ---- Lock (shared family password, with Face ID/Touch ID as a shortcut) ----
  // Change this to whatever you want the family to type in on first visit.
  // This is a friendly gate, not real security — anyone who views the page
  // source can read it, same as any client-only check.
  SITE_PASSWORD: "Corsica26",

  // Temporary toggle: set to false to skip the gate entirely (site opens
  // straight to the content, no password/Face ID prompt). Flip back to
  // true to restore the lock exactly as it was — nothing else changes.
  GATE_ENABLED: false,

  // Real numbers, from Matthieu's email. Keep the repo/hosting private if
  // that matters — the lock above only keeps out casual visitors.
  CONTACTS: [
    { name: "Matthieu Camilli (host)", role: "Villa host — arrival, questions, anything urgent", phone: "+33 6 88 03 62 26" },
    { name: "Ouliana Camilli (host)", role: "Villa host", phone: "+33 6 76 08 15 57" },
    { name: "Private chef — Gioia", role: "In-villa dinners", phone: "+33 7 89 59 33 49" },
    { name: "Private chef — Elisa", role: "In-villa dinners", phone: "+33 7 45 32 08 63" },
    { name: "Private chef — Pierre-Olivier", role: "In-villa dinners", phone: "+33 6 21 21 69 44" },
    { name: "Babysitter — Chiara-Marine", role: "Babysitting", phone: "+33 7 69 07 20 14" },
    { name: "Marie", role: "Personal trainer + kids' sports sessions", phone: "+33 7 89 33 49 57" },
    { name: "Corsil Bateau", role: "Boat hire, Pinarello", phone: "+33 4 95 71 44 41" },
    { name: "A Tyroliana", role: "Canyoning, Cavu valley", phone: "+33 4 95 21 78 04" },
    { name: "Spina Cavallu", role: "Horse riding, lieu-dit Bacca", phone: "", link: "https://www.google.com/maps/search/Spina+Cavallu+Sainte+Lucie+de+Porto+Vecchio" },
    { name: "Zappa'Horse Endurance", role: "Horse riding, lieu-dit Soppalazzo", phone: "", link: "https://www.google.com/maps/search/Zappa+Horse+Endurance+Sainte+Lucie+de+Porto+Vecchio" },
    { name: "Pharmacie Giumetti Bartoli", role: "Route de Pinarello, Sainte-Lucie-de-Porto-Vecchio", phone: "+33 4 95 71 41 40" },
    { name: "Emergency (EU-wide)", role: "Ambulance / police / fire", phone: "112" },
  ],

  // Paste a Google My Maps share link here once you've built one with all
  // the pins (villas, beaches, restaurants, essentials). Until then this
  // falls back to a plain search embed of the area.
  MAP_EMBED_URL: "https://maps.google.com/maps?q=Sainte-Lucie-de-Porto-Vecchio,Corsica&z=12&output=embed",
  MAP_LINK_URL: "https://www.google.com/maps/search/Sainte-Lucie-de-Porto-Vecchio,+Corsica",

  // ---- Forum (posts an idea/link/photo, with delete) ----
  // Paste the public "fill out this form" link here once you've created it.
  FORUM_FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSd5DG4mhmARQAZESthF1_qHjy9MMwcDjJ2KK3WHnvupZqVzLw/viewform",

  // ---- Shared Google Apps Script backend ----
  // One deployment serves both the forum feed/delete AND the editable
  // itinerary — see setup notes sent separately. Paste the deployed web
  // app URL here once it's live.
  SHEETS_API_URL: "https://script.google.com/macros/s/AKfycbx3soPQ3oA_Xbq-xeuDy8-oUuwkqxr5kYD0s1qH8SJHN6RtQzwliuQ00xeRDeFDhQxXug/exec",
};
