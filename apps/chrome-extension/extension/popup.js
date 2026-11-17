import { reviewUrl, selectedPlace } from "./capture.js"

document
  .querySelector("#settings")
  .addEventListener("click", () => chrome.runtime.openOptionsPage())
const status = document.querySelector("#status")
try {
  const { instance } = await chrome.storage.local.get("instance")
  if (!instance) {
    await chrome.runtime.openOptionsPage()
    window.close()
  } else {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true })
    const place = selectedPlace(tab?.url)
    if (place) {
      await chrome.tabs.create({ url: reviewUrl(instance, place) })
      window.close()
    } else {
      status.textContent = "Open a place in Google Maps, then click Save to Placard."
    }
  }
} catch (error) {
  status.textContent = error.message
}
